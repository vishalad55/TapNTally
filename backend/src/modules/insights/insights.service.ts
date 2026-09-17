import { Injectable } from '@nestjs/common';
import { Category, Recap, formatPaise } from '@tapntally/shared';
import { AuthUser } from '../../common/auth/current-user.decorator';
import { monthRange, weekRange } from '../../common/utils/period';
import { TransactionsService } from '../transactions/transactions.service';

const fmt = (p: number) => formatPaise(p, { showDecimals: false });

@Injectable()
export class InsightsService {
  constructor(private readonly transactions: TransactionsService) {}

  async recap(me: AuthUser, period: 'weekly' | 'monthly', scope: 'personal' | 'shared' = 'personal'): Promise<Recap> {
    const now = new Date();
    const current = period === 'weekly' ? weekRange(now, 0) : monthRange(now, 0);
    const previous = period === 'weekly' ? weekRange(now, -1) : monthRange(now, -1);

    const [cur, prev, txs] = await Promise.all([
      this.transactions.summaryForRange(me, current, scope),
      this.transactions.summaryForRange(me, previous, scope),
      this.transactions.findInRange(me, current, scope),
    ]);

    const prevBy = new Map(prev.byCategory.map((c) => [c.category.id, c.amountPaise]));
    const curBy = new Map(cur.byCategory.map((c) => [c.category.id, c.amountPaise]));
    const allCats = new Map<string, Category>();
    for (const c of [...cur.byCategory, ...prev.byCategory]) allCats.set(c.category.id, c.category);

    let biggestIncrease: Recap['biggestIncrease'] = null;
    let biggestSaving: Recap['biggestSaving'] = null;
    for (const [id, category] of allCats) {
      const delta = (curBy.get(id) ?? 0) - (prevBy.get(id) ?? 0);
      if (delta > 0 && (!biggestIncrease || delta > biggestIncrease.deltaPaise)) biggestIncrease = { category, deltaPaise: delta };
      if (delta < 0 && (!biggestSaving || delta < biggestSaving.deltaPaise)) biggestSaving = { category, deltaPaise: delta };
    }

    const merchants = new Map<string, { merchant: string; count: number; amountPaise: number }>();
    let priciest = txs[0] ?? null;
    for (const t of txs) {
      const m = merchants.get(t.merchantKey) ?? { merchant: t.merchant, count: 0, amountPaise: 0 };
      m.count++;
      m.amountPaise += t.amountPaise;
      merchants.set(t.merchantKey, m);
      if (!priciest || t.amountPaise > priciest.amountPaise) priciest = t;
    }
    const topMerchant = [...merchants.values()].sort((a, b) => b.count - a.count || b.amountPaise - a.amountPaise)[0] ?? null;

    const changeRatio = prev.totalPaise > 0 ? (cur.totalPaise - prev.totalPaise) / prev.totalPaise : null;
    const label = period === 'weekly' ? 'week' : 'month';

    const headline = buildHeadline(cur.totalPaise, changeRatio, label);
    const highlights: string[] = [];
    if (biggestIncrease) highlights.push(`${biggestIncrease.category.name} climbed by ${fmt(biggestIncrease.deltaPaise)}. Worth a look?`);
    if (biggestSaving) highlights.push(`You trimmed ${fmt(-biggestSaving.deltaPaise)} off ${biggestSaving.category.name}. Nice.`);
    if (topMerchant && topMerchant.count > 1) highlights.push(`${topMerchant.merchant} saw you ${topMerchant.count} times — ${fmt(topMerchant.amountPaise)} in total.`);
    if (priciest) highlights.push(`Biggest single purchase: ${fmt(priciest.amountPaise)} at ${priciest.merchant}.`);
    if (cur.byCategory[0]) highlights.push(`${cur.byCategory[0].category.name} took the biggest slice at ${Math.round(cur.byCategory[0].share * 100)}%.`);
    if (highlights.length === 0) highlights.push(`Nothing recorded this ${label} yet. Tap a terminal or connect Gmail to get started.`);

    return {
      period,
      periodStart: current.start.toISOString(),
      periodEnd: current.end.toISOString(),
      totalPaise: cur.totalPaise,
      previousTotalPaise: prev.totalPaise,
      changeRatio,
      biggestIncrease,
      biggestSaving,
      topMerchant,
      priciestPurchase: priciest ? this.transactions.toDto(priciest) : null,
      headline,
      highlights,
    };
  }
}

function buildHeadline(total: number, change: number | null, label: string): string {
  if (total === 0) return `A quiet ${label} — nothing spent yet.`;
  if (change === null) return `You spent ${fmt(total)} this ${label}. First one on the books!`;
  const pct = Math.round(Math.abs(change) * 100);
  if (pct < 3) return `${fmt(total)} this ${label} — almost exactly like last ${label}. Consistency!`;
  if (change < 0) return `${fmt(total)} this ${label}, ${pct}% less than last ${label}. Nicely done.`;
  if (pct > 40) return `${fmt(total)} this ${label} — ${pct}% up on last ${label}. Big ${label}?`;
  return `${fmt(total)} this ${label}, ${pct}% more than last ${label}. Keep an eye on it.`;
}
