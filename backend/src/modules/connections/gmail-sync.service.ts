import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ConnectionStatus, ConnectionType, KNOWN_SENDER_DOMAINS, PURCHASE_SUBJECT_KEYWORDS, TransactionSource } from '@tapntally/shared';
import { LessThan, Repository } from 'typeorm';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AppConfigService } from '../../config/app-config.service';
import { ConnectionEntity } from '../../database/entities';
import { PushService } from '../notifications/push.service';
import { GmailJob, JOBS, QueueService } from '../queue/queue.service';
import { TransactionsService } from '../transactions/transactions.service';
import { GmailClient, GmailTokens } from './gmail.client';
import { looksLikePurchase, parseEmail } from './parsing/gmail-parser';

const BACKFILL_MAX_MESSAGES = 500;
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Gmail ingestion. Two paths:
 *  - Backfill: one-time, search-scoped to known senders + purchase subjects.
 *  - Incremental: history.list from the stored cursor, triggered by Pub/Sub
 *    push (webhook) with a 30-minute polling fallback.
 *
 * Email bodies are fetched, parsed and discarded in the same tick.
 */
@Injectable()
export class GmailSyncService implements OnModuleInit {
  private readonly logger = new Logger(GmailSyncService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly crypto: EncryptionService,
    private readonly gmail: GmailClient,
    private readonly transactions: TransactionsService,
    private readonly push: PushService,
    private readonly queue: QueueService,
    @InjectRepository(ConnectionEntity) private readonly connections: Repository<ConnectionEntity>,
  ) {}

  onModuleInit() {
    this.queue.register<GmailJob>(JOBS.GMAIL_BACKFILL, (j) => this.backfill(j.connectionId));
    this.queue.register<GmailJob>(JOBS.GMAIL_SYNC, (j) => this.sync(j.connectionId));
    this.queue.register<GmailJob>(JOBS.GMAIL_RENEW_WATCH, (j) => this.renewWatch(j.connectionId));
  }

  /** Search query that keeps us out of personal mail. */
  backfillQuery(days: number): string {
    const senders = KNOWN_SENDER_DOMAINS.map((d) => `from:${d}`).join(' OR ');
    const subjects = PURCHASE_SUBJECT_KEYWORDS.map((k) => `subject:"${k}"`).join(' OR ');
    return `(${senders} OR ${subjects}) newer_than:${days}d -subject:cancelled -subject:refund`;
  }

  async backfill(connectionId: string): Promise<void> {
    const conn = await this.connections.findOne({ where: { id: connectionId } });
    if (!conn || conn.type !== ConnectionType.GMAIL || !conn.encryptedTokens) return;
    const tokens = this.tokens(conn);
    const save = this.tokenSaver(conn);

    try {
      const ids = await this.gmail.listMessageIds(tokens, this.backfillQuery(this.config.get('GMAIL_BACKFILL_DAYS')), BACKFILL_MAX_MESSAGES, save);
      this.logger.log(`Gmail backfill for ${conn.userId}: ${ids.length} candidate messages`);
      const imported = await this.processMessages(conn, tokens, ids, save);

      const profile = await this.gmail.profile(tokens, save);
      conn.gmailHistoryId = profile.historyId;
      conn.status = ConnectionStatus.ACTIVE;
      conn.lastSyncedAt = new Date();
      conn.consecutiveFailures = 0;
      conn.lastError = null;
      await this.connections.save(conn);

      await this.push.sendToUser(conn.userId, {
        title: imported > 0 ? `${imported} purchase${imported === 1 ? '' : 's'} found in Gmail` : 'Gmail connected',
        body: imported > 0 ? 'Your online orders are now in TapNTally.' : "We'll add new orders as they arrive.",
        data: { screen: 'home' },
      });
      await this.queue.enqueue<GmailJob>(JOBS.GMAIL_RENEW_WATCH, { connectionId });
    } catch (err) {
      await this.recordFailure(conn, err);
      throw err;
    }
  }

  async sync(connectionId: string): Promise<void> {
    const conn = await this.connections.findOne({ where: { id: connectionId } });
    if (!conn || conn.type !== ConnectionType.GMAIL || !conn.encryptedTokens || conn.status === ConnectionStatus.NEEDS_REAUTH) return;
    const tokens = this.tokens(conn);
    const save = this.tokenSaver(conn);

    try {
      let ids: string[];
      if (conn.gmailHistoryId) {
        const h = await this.gmail.historySince(tokens, conn.gmailHistoryId, save);
        if (h === null) {
          this.logger.warn(`History cursor stale for ${conn.userId}; falling back to a 7-day search`);
          ids = await this.gmail.listMessageIds(tokens, this.backfillQuery(7), 200, save);
        } else {
          ids = h.ids;
          conn.gmailHistoryId = h.historyId;
        }
      } else {
        ids = await this.gmail.listMessageIds(tokens, this.backfillQuery(2), 100, save);
        conn.gmailHistoryId = (await this.gmail.profile(tokens, save)).historyId;
      }

      const imported = await this.processMessages(conn, tokens, ids, save);
      conn.lastSyncedAt = new Date();
      conn.consecutiveFailures = 0;
      conn.lastError = null;
      conn.status = ConnectionStatus.ACTIVE;
      await this.connections.save(conn);
      if (imported > 0) {
        await this.push.sendToUser(conn.userId, {
          title: imported === 1 ? 'New purchase added' : `${imported} new purchases added`,
          body: 'Synced from your Gmail order confirmations.',
          data: { screen: 'home' },
        });
      }
    } catch (err) {
      await this.recordFailure(conn, err);
      throw err;
    }
  }

  async renewWatch(connectionId: string): Promise<void> {
    const topic = this.config.get('GMAIL_PUBSUB_TOPIC');
    if (!topic) return; // polling-only deployment
    const conn = await this.connections.findOne({ where: { id: connectionId } });
    if (!conn?.encryptedTokens) return;
    const { expiration } = await this.gmail.watch(this.tokens(conn), topic, this.tokenSaver(conn));
    conn.gmailWatchExpiresAt = expiration;
    await this.connections.save(conn);
  }

  /** Fetch, parse, ingest. Returns count of newly created transactions. */
  private async processMessages(conn: ConnectionEntity, tokens: GmailTokens, ids: string[], save: (t: GmailTokens) => void): Promise<number> {
    let imported = 0;
    for (const id of ids) {
      try {
        const summary = await this.gmail.getSummary(tokens, id, save);
        if (!looksLikePurchase(summary.from, summary.subject)) continue;
        const full = await this.gmail.getFull(tokens, id, save);
        const parsed = parseEmail({ messageId: id, from: full.from, subject: full.subject, body: full.bodyText, receivedAt: full.receivedAt });
        if (!parsed) continue;

        const { created } = await this.transactions.ingest({
          userId: conn.userId,
          source: TransactionSource.GMAIL,
          merchant: parsed.merchant,
          amountPaise: parsed.amountPaise,
          occurredAt: full.receivedAt,
          paymentMethod: parsed.paymentMethod,
          items: parsed.items,
          context: full.subject,
          rawSourceRef: id,
          dedupeKey: `gmail:${conn.userId}:${id}`,
        });
        if (created) imported++;
      } catch (err) {
        // One bad email must never abort the batch.
        this.logger.warn(`Skipping Gmail message ${id}: ${String(err)}`);
      }
    }
    if (imported) {
      conn.importedCount += imported;
      await this.connections.save(conn);
    }
    return imported;
  }

  private tokens(conn: ConnectionEntity): GmailTokens {
    return JSON.parse(this.crypto.decrypt(conn.encryptedTokens!)) as GmailTokens;
  }

  /** Persist refreshed access tokens as google-auth-library rotates them. */
  private tokenSaver(conn: ConnectionEntity) {
    return (t: GmailTokens) => {
      const merged = { ...this.tokens(conn), ...t, refresh_token: t.refresh_token ?? this.tokens(conn).refresh_token };
      conn.encryptedTokens = this.crypto.encrypt(JSON.stringify(merged));
      void this.connections.save(conn);
    };
  }

  private async recordFailure(conn: ConnectionEntity, err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const authError = /invalid_grant|unauthorized|401|403/i.test(message);
    conn.consecutiveFailures += 1;
    conn.lastError = message.slice(0, 500);
    if (authError) conn.status = ConnectionStatus.NEEDS_REAUTH;
    else if (conn.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) conn.status = ConnectionStatus.ERROR;
    await this.connections.save(conn);
    this.logger.error(`Gmail sync failed for ${conn.userId} (${conn.consecutiveFailures}x): ${message}`);
  }

  // ------------------------------------------------------------- schedules

  /** Polling fallback: covers deployments without Pub/Sub and any missed pushes. */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async pollActive() {
    const conns = await this.connections.find({ where: { type: ConnectionType.GMAIL, status: ConnectionStatus.ACTIVE } });
    for (const c of conns) await this.queue.enqueue<GmailJob>(JOBS.GMAIL_SYNC, { connectionId: c.id }, { jobId: c.id });
  }

  /** Gmail watches last ≤7 days; renew anything expiring within a day. */
  @Cron(CronExpression.EVERY_6_HOURS)
  async renewExpiringWatches() {
    if (!this.config.get('GMAIL_PUBSUB_TOPIC')) return;
    const soon = new Date(Date.now() + 24 * 3600 * 1000);
    const conns = await this.connections.find({
      where: [{ type: ConnectionType.GMAIL, status: ConnectionStatus.ACTIVE, gmailWatchExpiresAt: LessThan(soon) }],
    });
    for (const c of conns) await this.queue.enqueue<GmailJob>(JOBS.GMAIL_RENEW_WATCH, { connectionId: c.id }, { jobId: `w:${c.id}` });
  }
}
