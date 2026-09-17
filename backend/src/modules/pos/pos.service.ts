import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionSource, validateTbefBill } from '@tapntally/shared';
import { customAlphabet } from 'nanoid';
import { createHash } from 'node:crypto';
import { MoreThan, IsNull, Repository } from 'typeorm';
import { AuthUser } from '../../common/auth/current-user.decorator';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AppError } from '../../common/filters/http-exception.filter';
import { PairingCodeEntity, PosPartnerEntity, PosTerminalEntity, TransactionEntity } from '../../database/entities';
import { PushService } from '../notifications/push.service';
import { TransactionsService } from '../transactions/transactions.service';

const pairingGen = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);
const PAIRING_TTL_MS = 5 * 60 * 1000;

/**
 * POS partner integration layer.
 *
 *  - Terminal enrolment: gives a terminal an HMAC secret so its NFC bills
 *    verify (see NfcService).
 *  - Partner API keys: lets a network push bills server-to-server for
 *    terminals that can't write NFC, routed to a user by a pairing code the
 *    app displays at checkout.
 */
@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    @InjectRepository(PosTerminalEntity) private readonly terminals: Repository<PosTerminalEntity>,
    @InjectRepository(PosPartnerEntity) private readonly partners: Repository<PosPartnerEntity>,
    @InjectRepository(PairingCodeEntity) private readonly pairings: Repository<PairingCodeEntity>,
    private readonly crypto: EncryptionService,
    private readonly transactions: TransactionsService,
    private readonly push: PushService,
  ) {}

  // ---------------------------------------------------------- operator ops

  async enrollTerminal(input: { network: string; terminalId: string; merchantName: string; merchantGstin?: string; secret?: string }) {
    const existing = await this.terminals.findOne({ where: { network: input.network, terminalId: input.terminalId } });
    const secret = input.secret ?? this.crypto.randomToken(32);
    const entity =
      existing ?? this.terminals.create({ network: input.network, terminalId: input.terminalId, active: true, billsReceived: 0 });
    entity.merchantName = input.merchantName;
    entity.merchantGstin = input.merchantGstin ?? null;
    entity.encryptedSecret = this.crypto.encrypt(secret);
    const saved = await this.terminals.save(entity);
    // The plaintext secret is returned exactly once, for provisioning the terminal.
    return { id: saved.id, network: saved.network, terminalId: saved.terminalId, merchantName: saved.merchantName, secret };
  }

  async listTerminals() {
    const rows = await this.terminals.find({ order: { network: 'ASC', terminalId: 'ASC' } });
    return rows.map((t) => ({
      id: t.id, network: t.network, terminalId: t.terminalId, merchantName: t.merchantName,
      merchantGstin: t.merchantGstin, active: t.active, billsReceived: t.billsReceived, createdAt: t.createdAt.toISOString(),
    }));
  }

  async setTerminalActive(id: string, active: boolean) {
    await this.terminals.update({ id }, { active });
  }

  async createPartner(input: { network: string; displayName: string }) {
    const apiKey = `tnt_${this.crypto.randomToken(32)}`;
    const existing = await this.partners.findOne({ where: { network: input.network } });
    const entity = existing ?? this.partners.create({ network: input.network, active: true });
    entity.displayName = input.displayName;
    entity.apiKeyHash = sha256(apiKey);
    const saved = await this.partners.save(entity);
    return { id: saved.id, network: saved.network, displayName: saved.displayName, apiKey };
  }

  async authenticatePartner(apiKey: string | undefined): Promise<PosPartnerEntity> {
    if (!apiKey) throw new AppError('PARTNER_UNAUTHORIZED', 'Missing partner API key', HttpStatus.UNAUTHORIZED);
    const partner = await this.partners.findOne({ where: { apiKeyHash: sha256(apiKey), active: true } });
    if (!partner) throw new AppError('PARTNER_UNAUTHORIZED', 'Invalid partner API key', HttpStatus.UNAUTHORIZED);
    return partner;
  }

  // -------------------------------------------------------------- user ops

  async createPairingCode(me: AuthUser): Promise<{ code: string; expiresAt: string }> {
    // Invalidate any live code so only one is valid at a time.
    await this.pairings.update({ userId: me.id, usedAt: IsNull() }, { usedAt: new Date() });
    for (let i = 0; i < 5; i++) {
      const code = pairingGen();
      if (await this.pairings.findOne({ where: { code } })) continue;
      const row = await this.pairings.save(
        this.pairings.create({ userId: me.id, code, expiresAt: new Date(Date.now() + PAIRING_TTL_MS), usedAt: null }),
      );
      return { code: row.code, expiresAt: row.expiresAt.toISOString() };
    }
    throw new Error('Could not generate pairing code');
  }

  // ----------------------------------------------------------- partner ops

  /** Server-to-server bill push. The partner is authenticated, so bills are treated as verified. */
  async pushBill(partner: PosPartnerEntity, pairingCode: string, rawBill: unknown): Promise<{ transaction: TransactionEntity; created: boolean }> {
    const validation = validateTbefBill(rawBill);
    if (!validation.ok) throw new AppError('POS_MALFORMED_BILL', 'Bill failed validation', HttpStatus.UNPROCESSABLE_ENTITY, { errors: validation.errors });
    const bill = validation.bill;
    if (bill.terminal.network !== partner.network) {
      throw new AppError('POS_NETWORK_MISMATCH', `Bill network "${bill.terminal.network}" does not match partner "${partner.network}"`, HttpStatus.FORBIDDEN);
    }

    const pairing = await this.pairings.findOne({
      where: { code: pairingCode.toUpperCase(), usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!pairing) throw new AppError('POS_INVALID_PAIRING', 'Pairing code is invalid or expired', HttpStatus.NOT_FOUND);

    const result = await this.transactions.ingest({
      userId: pairing.userId,
      source: TransactionSource.POS_PARTNER,
      merchant: bill.merchant.name,
      amountPaise: bill.totalPaise,
      occurredAt: new Date(bill.issuedAt),
      paymentMethod: bill.paymentMethod,
      items: bill.items.map((i) => ({ name: i.name, qty: i.qty, unitPaise: i.unitPaise, totalPaise: i.totalPaise, sku: i.sku })),
      mcc: bill.merchant.mcc,
      rawSourceRef: bill.billId,
      dedupeKey: `pos:${bill.terminal.network}:${bill.terminal.terminalId}:${bill.billId}`,
      signatureVerified: true,
      terminalNetwork: bill.terminal.network,
      terminalId: bill.terminal.terminalId,
    });

    if (result.created) {
      pairing.usedAt = new Date();
      await this.pairings.save(pairing);
      await this.terminals.increment({ network: bill.terminal.network, terminalId: bill.terminal.terminalId }, 'billsReceived', 1);
      await this.push.sendToUser(pairing.userId, {
        title: `Receipt from ${bill.merchant.name}`,
        body: `Filed under ${result.transaction.category.name}. Tap to review.`,
        data: { screen: 'transaction', transactionId: result.transaction.id },
      });
      this.logger.log(`Partner ${partner.network} pushed bill ${bill.billId} → user ${pairing.userId}`);
    }
    return result;
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
