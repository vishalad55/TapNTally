import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CategoryConfidence,
  CategorySpend,
  Paginated,
  PaymentMethod,
  SpendSummary,
  Transaction,
  TransactionItem,
  TransactionSource,
  categorize,
  normalizeMerchant,
} from '@tapntally/shared';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { AuthUser } from '../../common/auth/current-user.decorator';
import { AppError } from '../../common/filters/http-exception.filter';
import { PeriodRange, monthRange, weekRange } from '../../common/utils/period';
import { TransactionEntity, UserEntity } from '../../database/entities';
import { CategoriesService } from '../categories/categories.service';
import { BudgetCheckJob, JOBS, QueueService } from '../queue/queue.service';
import { TransactionQueryDto, UpdateTransactionDto } from './dto';

/**
 * Everything that becomes a transaction — NFC bill, parsed email, SMS,
 * manual entry, partner push — flows through `ingest()`. That single path
 * guarantees consistent categorisation, dedupe, household denormalisation
 * and budget-alert scheduling regardless of source.
 */
export interface IngestInput {
  userId: string;
  source: TransactionSource;
  merchant: string;
  amountPaise: number;
  occurredAt: Date;
  paymentMethod?: PaymentMethod;
  items?: TransactionItem[];
  /** Explicit category chosen by the user (manual entry). Skips auto-categorisation. */
  categoryId?: string;
  /** Extra signals for the categoriser. */
  mcc?: string;
  context?: string;
  rawSourceRef?: string;
  dedupeKey?: string;
  idempotencyKey?: string;
  signatureVerified?: boolean;
  terminalNetwork?: string;
  terminalId?: string;
  isShared?: boolean;
  tags?: string[];
  notes?: string;
}

export interface IngestResult {
  transaction: TransactionEntity;
  /** False when dedupe/idempotency matched an existing row. */
  created: boolean;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(TransactionEntity) private readonly txRepo: Repository<TransactionEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly categories: CategoriesService,
    private readonly queue: QueueService,
  ) {}

  async ingest(input: IngestInput): Promise<IngestResult> {
    if (input.idempotencyKey) {
      const existing = await this.txRepo.findOne({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return { transaction: existing, created: false };
    }
    if (input.dedupeKey) {
      const existing = await this.txRepo.findOne({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return { transaction: existing, created: false };
    }

    const user = await this.users.findOneOrFail({ where: { id: input.userId } });

    let categoryId: string;
    let confidence: CategoryConfidence;
    let reason: string | null;
    let confirmed = false;
    if (input.categoryId) {
      categoryId = (await this.categories.resolveForUser(user.id, input.categoryId)).id;
      confidence = CategoryConfidence.HIGH;
      reason = 'user';
      confirmed = true;
    } else {
      const result = categorize({
        merchant: input.merchant,
        itemNames: input.items?.map((i) => i.name),
        mcc: input.mcc,
        context: input.context,
      });
      categoryId = this.categories.bySlug(result.slug).id;
      confidence = result.confidence;
      reason = result.reason;
    }

    const entity = this.txRepo.create({
      userId: user.id,
      householdId: user.householdId,
      source: input.source,
      merchant: input.merchant.trim().slice(0, 200),
      merchantKey: normalizeMerchant(input.merchant) || 'unknown',
      amountPaise: input.amountPaise,
      currency: 'INR',
      categoryId,
      categoryConfidence: confidence,
      categoryConfirmed: confirmed,
      categoryReason: reason,
      paymentMethod: input.paymentMethod ?? PaymentMethod.UNKNOWN,
      items: input.items ?? [],
      isShared: input.isShared ?? false,
      tags: input.tags ?? [],
      notes: input.notes ?? null,
      rawSourceRef: input.rawSourceRef ?? null,
      dedupeKey: input.dedupeKey ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      signatureVerified: input.signatureVerified ?? false,
      terminalNetwork: input.terminalNetwork ?? null,
      terminalId: input.terminalId ?? null,
      occurredAt: input.occurredAt,
    });

    let saved: TransactionEntity;
    try {
      saved = await this.txRepo.save(entity);
    } catch (err) {
      // Concurrent insert of the same bill — the unique index won the race; return the winner.
      const dupe = input.dedupeKey
        ? await this.txRepo.findOne({ where: { dedupeKey: input.dedupeKey } })
        : input.idempotencyKey
          ? await this.txRepo.findOne({ where: { idempotencyKey: input.idempotencyKey } })
          : null;
      if (dupe) return { transaction: dupe, created: false };
      throw err;
    }

    const full = await this.txRepo.findOneOrFail({ where: { id: saved.id } });
    await this.scheduleBudgetCheck(full);
    return { transaction: full, created: true };
  }

  private async scheduleBudgetCheck(tx: TransactionEntity) {
    const job: BudgetCheckJob = { userId: tx.userId, householdId: tx.householdId, categoryId: tx.categoryId };
    // Coalesce bursts (e.g. a 40-email backfill) into one check per user+category.
    await this.queue.enqueue(JOBS.BUDGET_CHECK, job, { jobId: `${tx.userId}:${tx.categoryId}`, delayMs: 2_000 });
  }

  async getOwned(me: AuthUser, id: string): Promise<TransactionEntity> {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new AppError('TX_NOT_FOUND', 'Transaction not found', HttpStatus.NOT_FOUND);
    const isMine = tx.userId === me.id;
    const isHouseholdShared = tx.isShared && me.householdId !== null && tx.householdId === me.householdId;
    if (!isMine && !isHouseholdShared) throw new AppError('TX_NOT_FOUND', 'Transaction not found', HttpStatus.NOT_FOUND);
    return tx;
  }

  async update(me: AuthUser, id: string, patch: UpdateTransactionDto): Promise<TransactionEntity> {
    const tx = await this.getOwned(me, id);
    if (tx.userId !== me.id) {
      throw new AppError('TX_FORBIDDEN', 'Only the person who made this purchase can edit it', HttpStatus.FORBIDDEN);
    }
    if (patch.categoryId !== undefined) {
      const category = await this.categories.resolveForUser(me.id, patch.categoryId);
      // Set both: with an eager relation loaded, TypeORM writes the FK from the
      // relation object on save, so changing only `categoryId` would be discarded.
      tx.categoryId = category.id;
      tx.category = category;
      tx.categoryConfidence = CategoryConfidence.HIGH;
      tx.categoryConfirmed = true;
      tx.categoryReason = 'user';
    }
    if (patch.tags !== undefined) tx.tags = [...new Set(patch.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    if (patch.notes !== undefined) tx.notes = patch.notes;
    if (patch.isShared !== undefined) tx.isShared = patch.isShared;
    if (patch.merchant !== undefined) {
      tx.merchant = patch.merchant.trim();
      tx.merchantKey = normalizeMerchant(tx.merchant) || 'unknown';
    }
    if (patch.amountPaise !== undefined) tx.amountPaise = patch.amountPaise;
    if (patch.occurredAt !== undefined) tx.occurredAt = new Date(patch.occurredAt);
    if (patch.paymentMethod !== undefined) tx.paymentMethod = patch.paymentMethod;

    const saved = await this.txRepo.save(tx);
    const full = await this.txRepo.findOneOrFail({ where: { id: saved.id } });
    if (patch.categoryId !== undefined || patch.amountPaise !== undefined) await this.scheduleBudgetCheck(full);
    return full;
  }

  async remove(me: AuthUser, id: string): Promise<void> {
    const tx = await this.getOwned(me, id);
    if (tx.userId !== me.id) throw new AppError('TX_FORBIDDEN', 'Only the owner can delete this', HttpStatus.FORBIDDEN);
    await this.txRepo.remove(tx);
  }

  /** Sets householdId on all of a user's transactions (join/leave household). */
  async reassignHousehold(userId: string, householdId: string | null): Promise<void> {
    await this.txRepo.update({ userId }, { householdId });
  }

  // ---------------------------------------------------------------- queries

  private baseQuery(me: AuthUser, scope: 'personal' | 'shared' | 'all'): SelectQueryBuilder<TransactionEntity> {
    const qb = this.txRepo.createQueryBuilder('t').leftJoinAndSelect('t.category', 'category');
    if (scope === 'shared') {
      if (!me.householdId) {
        // No household → shared feed is empty. Use a predicate that's false everywhere.
        qb.where('1 = 0');
      } else {
        qb.where('t.householdId = :hid AND t.isShared = :shared', { hid: me.householdId, shared: true });
      }
    } else if (scope === 'all' && me.householdId) {
      qb.where(
        new Brackets((w) =>
          w.where('t.userId = :uid', { uid: me.id }).orWhere('(t.householdId = :hid AND t.isShared = :shared)', {
            hid: me.householdId,
            shared: true,
          }),
        ),
      );
    } else {
      qb.where('t.userId = :uid', { uid: me.id });
    }
    return qb;
  }

  async list(me: AuthUser, q: TransactionQueryDto): Promise<Paginated<Transaction>> {
    const limit = q.limit ?? 30;
    const qb = this.baseQuery(me, q.scope ?? 'personal');

    if (q.q) qb.andWhere('LOWER(t.merchant) LIKE :q', { q: `%${q.q.toLowerCase()}%` });
    if (q.categoryIds?.length) qb.andWhere('t.categoryId IN (:...cats)', { cats: q.categoryIds });
    if (q.sources?.length) qb.andWhere('t.source IN (:...sources)', { sources: q.sources });
    if (q.paymentMethods?.length) qb.andWhere('t.paymentMethod IN (:...pms)', { pms: q.paymentMethods });
    if (q.minPaise !== undefined) qb.andWhere('t.amountPaise >= :min', { min: q.minPaise });
    if (q.maxPaise !== undefined) qb.andWhere('t.amountPaise <= :max', { max: q.maxPaise });
    if (q.from) qb.andWhere('t.occurredAt >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('t.occurredAt < :to', { to: new Date(q.to) });

    const total = await qb.clone().getCount();

    if (q.cursor) {
      const { occurredAt, id } = decodeCursor(q.cursor);
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('t.occurredAt < :cAt', { cAt: occurredAt })
            .orWhere('(t.occurredAt = :cAt AND t.id < :cId)', { cAt: occurredAt, cId: id }),
        ),
      );
    }

    const rows = await qb.orderBy('t.occurredAt', 'DESC').addOrderBy('t.id', 'DESC').take(limit + 1).getMany();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return {
      items: page.map((t) => this.toDto(t)),
      nextCursor: hasMore && last ? encodeCursor(last.occurredAt, last.id) : null,
      total,
    };
  }

  async summary(
    me: AuthUser,
    opts: { period?: 'month' | 'week'; offset?: number; scope?: 'personal' | 'shared' } = {},
  ): Promise<SpendSummary> {
    const range = (opts.period ?? 'month') === 'week' ? weekRange(new Date(), opts.offset ?? 0) : monthRange(new Date(), opts.offset ?? 0);
    return this.summaryForRange(me, range, opts.scope ?? 'personal');
  }

  async summaryForRange(me: AuthUser, range: PeriodRange, scope: 'personal' | 'shared'): Promise<SpendSummary> {
    const rows = await this.baseQuery(me, scope)
      .select('t.categoryId', 'categoryId')
      .addSelect('SUM(t.amountPaise)', 'amountPaise')
      .addSelect('COUNT(*)', 'count')
      .andWhere('t.occurredAt >= :from AND t.occurredAt < :to', { from: range.start, to: range.end })
      .groupBy('t.categoryId')
      .getRawMany<{ categoryId: string; amountPaise: string | number; count: string | number }>();

    const cats = await this.categories.byIds(rows.map((r) => r.categoryId));
    const total = rows.reduce((s, r) => s + Number(r.amountPaise), 0);
    const byCategory: CategorySpend[] = rows
      .map((r) => ({
        category: this.categories.toDto(cats.get(r.categoryId)!),
        amountPaise: Number(r.amountPaise),
        transactionCount: Number(r.count),
        share: total > 0 ? Number(r.amountPaise) / total : 0,
      }))
      .sort((a, b) => b.amountPaise - a.amountPaise);

    return { periodStart: range.start.toISOString(), periodEnd: range.end.toISOString(), totalPaise: total, byCategory };
  }

  /** Sum for one category in a range — used by budget progress. */
  async spentInCategory(ownerScope: { userId?: string; householdId?: string }, categoryId: string, range: PeriodRange): Promise<number> {
    const qb = this.txRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amountPaise), 0)', 'sum')
      .where('t.categoryId = :categoryId', { categoryId })
      .andWhere('t.occurredAt >= :from AND t.occurredAt < :to', { from: range.start, to: range.end });
    if (ownerScope.userId) qb.andWhere('t.userId = :uid', { uid: ownerScope.userId });
    else qb.andWhere('t.householdId = :hid AND t.isShared = :shared', { hid: ownerScope.householdId, shared: true });
    const row = await qb.getRawOne<{ sum: string | number }>();
    return Number(row?.sum ?? 0);
  }

  async findInRange(me: AuthUser, range: PeriodRange, scope: 'personal' | 'shared'): Promise<TransactionEntity[]> {
    return this.baseQuery(me, scope)
      .andWhere('t.occurredAt >= :from AND t.occurredAt < :to', { from: range.start, to: range.end })
      .orderBy('t.occurredAt', 'DESC')
      .getMany();
  }

  toDto(t: TransactionEntity): Transaction {
    return {
      id: t.id,
      userId: t.userId,
      householdId: t.householdId,
      source: t.source,
      merchant: t.merchant,
      merchantKey: t.merchantKey,
      amountPaise: t.amountPaise,
      currency: 'INR',
      categoryId: t.categoryId,
      category: this.categories.toDto(t.category),
      categoryConfidence: t.categoryConfidence,
      categoryConfirmed: t.categoryConfirmed,
      paymentMethod: t.paymentMethod,
      items: t.items ?? [],
      isShared: t.isShared,
      tags: t.tags ?? [],
      notes: t.notes,
      rawSourceRef: t.rawSourceRef,
      occurredAt: t.occurredAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}

function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`).toString('base64url');
}
function decodeCursor(cursor: string): { occurredAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const occurredAt = new Date(iso);
  if (Number.isNaN(occurredAt.getTime()) || !id) throw new AppError('BAD_CURSOR', 'Invalid pagination cursor');
  return { occurredAt, id };
}
