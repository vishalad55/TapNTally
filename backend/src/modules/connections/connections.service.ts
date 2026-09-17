import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, ConnectionStatus, ConnectionType, SmsIngestResponse, TransactionSource } from '@tapntally/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/auth/current-user.decorator';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AppError } from '../../common/filters/http-exception.filter';
import { ConnectionEntity } from '../../database/entities';
import { GmailJob, JOBS, QueueService } from '../queue/queue.service';
import { TransactionsService } from '../transactions/transactions.service';
import { GmailClient } from './gmail.client';
import { parseSms } from './parsing/sms-parser';

export interface SmsMessageInput {
  id: string;
  sender: string;
  body: string;
  receivedAt: string;
}

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    @InjectRepository(ConnectionEntity) private readonly connections: Repository<ConnectionEntity>,
    private readonly crypto: EncryptionService,
    private readonly gmail: GmailClient,
    private readonly transactions: TransactionsService,
    private readonly queue: QueueService,
  ) {}

  async list(me: AuthUser): Promise<Connection[]> {
    const rows = await this.connections.find({ where: { userId: me.id } });
    return Object.values(ConnectionType).map((type) => {
      const row = rows.find((r) => r.type === type);
      return row
        ? this.toDto(row)
        : { id: `none:${type}`, userId: me.id, type, status: ConnectionStatus.DISCONNECTED, lastSyncedAt: null, importedCount: 0, lastError: null };
    });
  }

  private async getOrCreate(userId: string, type: ConnectionType): Promise<ConnectionEntity> {
    const existing = await this.connections.findOne({ where: { userId, type } });
    if (existing) return existing;
    return this.connections.create({ userId, type, status: ConnectionStatus.DISCONNECTED, importedCount: 0, consecutiveFailures: 0 });
  }

  // ---------------------------------------------------------------- Gmail

  async connectGmail(me: AuthUser, authCode: string): Promise<Connection> {
    let tokens;
    try {
      tokens = await this.gmail.exchangeCode(authCode);
    } catch (err) {
      this.logger.warn(`Gmail code exchange failed: ${String(err)}`);
      throw new AppError('GMAIL_AUTH_FAILED', 'Could not connect Gmail. Please try again.', HttpStatus.BAD_REQUEST);
    }
    const conn = await this.getOrCreate(me.id, ConnectionType.GMAIL);
    conn.encryptedTokens = this.crypto.encrypt(JSON.stringify(tokens));
    conn.status = ConnectionStatus.BACKFILLING;
    conn.lastError = null;
    conn.consecutiveFailures = 0;
    conn.gmailHistoryId = null;
    const saved = await this.connections.save(conn);
    await this.queue.enqueue<GmailJob>(JOBS.GMAIL_BACKFILL, { connectionId: saved.id }, { jobId: `bf:${saved.id}` });
    return this.toDto(saved);
  }

  async disconnectGmail(me: AuthUser): Promise<void> {
    const conn = await this.connections.findOne({ where: { userId: me.id, type: ConnectionType.GMAIL } });
    if (!conn) return;
    if (conn.encryptedTokens) {
      await this.gmail.revoke(JSON.parse(this.crypto.decrypt(conn.encryptedTokens)));
    }
    // Drop the tokens entirely; transactions already imported stay (they're the user's data).
    await this.connections.remove(conn);
  }

  async triggerGmailSync(me: AuthUser): Promise<Connection> {
    const conn = await this.connections.findOne({ where: { userId: me.id, type: ConnectionType.GMAIL } });
    if (!conn) throw new AppError('GMAIL_NOT_CONNECTED', 'Connect Gmail first', HttpStatus.BAD_REQUEST);
    if (conn.status === ConnectionStatus.NEEDS_REAUTH) throw new AppError('GMAIL_NEEDS_REAUTH', 'Please reconnect Gmail', HttpStatus.CONFLICT);
    await this.queue.enqueue<GmailJob>(conn.gmailHistoryId ? JOBS.GMAIL_SYNC : JOBS.GMAIL_BACKFILL, { connectionId: conn.id }, { jobId: `manual:${conn.id}` });
    return this.toDto(conn);
  }

  /** Called by the Pub/Sub webhook with the Gmail address that changed. */
  async onGmailPush(emailAddress: string): Promise<void> {
    const conn = await this.connections
      .createQueryBuilder('c')
      .innerJoin('users', 'u', 'u.id = c.userId')
      .where('c.type = :type AND LOWER(u.email) = :email', { type: ConnectionType.GMAIL, email: emailAddress.toLowerCase() })
      .getOne();
    if (conn) await this.queue.enqueue<GmailJob>(JOBS.GMAIL_SYNC, { connectionId: conn.id }, { jobId: conn.id });
  }

  // ------------------------------------------------------------------ SMS

  /** SMS is read on-device (Android); the server only records that it's enabled. */
  async enableSms(me: AuthUser): Promise<Connection> {
    const conn = await this.getOrCreate(me.id, ConnectionType.SMS);
    conn.status = ConnectionStatus.ACTIVE;
    conn.lastError = null;
    return this.toDto(await this.connections.save(conn));
  }

  async disableSms(me: AuthUser): Promise<void> {
    await this.connections.delete({ userId: me.id, type: ConnectionType.SMS });
  }

  /**
   * Batch parse SMS forwarded by the client. Bodies are parsed and discarded;
   * only the Android message id is retained as `rawSourceRef` for dedupe.
   */
  async ingestSms(me: AuthUser, messages: SmsMessageInput[]): Promise<SmsIngestResponse> {
    const conn = await this.getOrCreate(me.id, ConnectionType.SMS);
    if (conn.status !== ConnectionStatus.ACTIVE) {
      conn.status = ConnectionStatus.ACTIVE;
    }
    let parsed = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const msg of messages) {
      const receivedAt = new Date(msg.receivedAt);
      const result = parseSms(msg.body, Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt);
      if (!result) {
        skipped++;
        continue;
      }
      try {
        const { created } = await this.transactions.ingest({
          userId: me.id,
          source: TransactionSource.SMS,
          merchant: result.merchant,
          amountPaise: result.amountPaise,
          occurredAt: result.occurredAt ?? receivedAt,
          paymentMethod: result.paymentMethod,
          context: msg.sender,
          rawSourceRef: msg.id,
          dedupeKey: `sms:${me.id}:${msg.id}`,
        });
        if (created) parsed++;
        else duplicates++;
      } catch (err) {
        this.logger.warn(`SMS ${msg.id} failed to ingest: ${String(err)}`);
        skipped++;
      }
    }

    conn.lastSyncedAt = new Date();
    conn.importedCount += parsed;
    await this.connections.save(conn);
    return { parsed, skipped, duplicates };
  }

  toDto(c: ConnectionEntity): Connection {
    return {
      id: c.id,
      userId: c.userId,
      type: c.type,
      status: c.status,
      lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
      importedCount: c.importedCount,
      lastError: c.lastError,
    };
  }
}
