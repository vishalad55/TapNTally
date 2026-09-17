import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { TransactionEntity, UserEntity } from '../../database/entities';
import { CategoriesService } from '../categories/categories.service';

/**
 * Internal aggregation layer for future brand/retailer insight reports.
 *
 * Guarantees:
 *  - Only users with `aggregateInsightsConsent = true` are included.
 *  - Every bucket is k-anonymous: buckets with fewer than MIN_COHORT distinct
 *    users are suppressed, never returned.
 *  - Output contains no user ids, no transaction ids, no free-text notes.
 *
 * Not exposed to end users or partners; operator-only via X-Internal-Key.
 */
export const MIN_COHORT = 20;

export interface TrendBucket {
  /** ISO week start (Monday, IST). */
  weekStart: string;
  key: string;
  label: string;
  totalPaise: number;
  transactionCount: number;
  userCount: number;
  avgTicketPaise: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(TransactionEntity) private readonly tx: Repository<TransactionEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly categories: CategoriesService,
    private readonly config: AppConfigService,
  ) {}

  async consentSummary() {
    const [total, consented] = await Promise.all([this.users.count(), this.users.count({ where: { aggregateInsightsConsent: true } })]);
    return { totalUsers: total, consentedUsers: consented, minCohort: MIN_COHORT };
  }

  /** Weekly spend per canonical category across consenting users. */
  async categoryTrends(from: Date, to: Date, minCohortOverride?: number): Promise<TrendBucket[]> {
    // Pull per-transaction rows and bucket in JS: portable across sql.js/Postgres
    // and the dataset for a pilot is small. Move to SQL date_trunc at scale.
    const txs = await this.consentingTx(from, to)
      .select(['t.categoryId AS key', 't.userId AS userId', 't.amountPaise AS amountPaise', 't.occurredAt AS occurredAt'])
      .getRawMany<{ key: string; userId: string; amountPaise: number | string; occurredAt: string | Date }>();
    const cats = await this.categories.byIds([...new Set(txs.map((t) => t.key))]);
    return this.bucket(txs, (k) => {
      const c = cats.get(k);
      return c && !c.isCustom ? c.name : null; // custom categories excluded: not comparable across users
    }, minCohortOverride);
  }

  /** Weekly spend per merchant key across consenting users. */
  async merchantTrends(from: Date, to: Date, minCohortOverride?: number): Promise<TrendBucket[]> {
    const txs = await this.consentingTx(from, to)
      .select(['t.merchantKey AS key', 't.userId AS userId', 't.amountPaise AS amountPaise', 't.occurredAt AS occurredAt'])
      .getRawMany<{ key: string; userId: string; amountPaise: number | string; occurredAt: string | Date }>();
    return this.bucket(txs, (k) => k, minCohortOverride);
  }

  private consentingTx(from: Date, to: Date) {
    return this.tx
      .createQueryBuilder('t')
      .innerJoin('users', 'u', 'u.id = t.userId AND u.aggregateInsightsConsent = :consent', { consent: true })
      .where('t.occurredAt >= :from AND t.occurredAt < :to', { from, to });
  }

  private bucket(
    txs: Array<{ key: string; userId: string; amountPaise: number | string; occurredAt: string | Date }>,
    labelFor: (key: string) => string | null,
    minCohortOverride?: number,
  ): TrendBucket[] {
    // The override exists so the layer can be demonstrated on a seeded DB; production ignores it.
    const minCohort = this.config.isProd ? MIN_COHORT : (minCohortOverride ?? MIN_COHORT);
    const acc = new Map<string, { weekStart: string; key: string; total: number; count: number; users: Set<string> }>();
    for (const t of txs) {
      const weekStart = istWeekStart(new Date(t.occurredAt));
      const id = `${weekStart}|${t.key}`;
      const b = acc.get(id) ?? { weekStart, key: t.key, total: 0, count: 0, users: new Set() };
      b.total += Number(t.amountPaise);
      b.count += 1;
      b.users.add(t.userId);
      acc.set(id, b);
    }
    const out: TrendBucket[] = [];
    for (const b of acc.values()) {
      if (b.users.size < minCohort) continue;
      const label = labelFor(b.key);
      if (label === null) continue;
      out.push({
        weekStart: b.weekStart,
        key: b.key,
        label,
        totalPaise: b.total,
        transactionCount: b.count,
        userCount: b.users.size,
        avgTicketPaise: Math.round(b.total / b.count),
      });
    }
    return out.sort((a, b) => a.weekStart.localeCompare(b.weekStart) || b.totalPaise - a.totalPaise);
  }
}

function istWeekStart(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const dow = (ist.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - dow));
  return start.toISOString().slice(0, 10);
}
