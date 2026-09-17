import { BudgetPeriod } from '@tapntally/shared';

/**
 * Period boundaries in Indian Standard Time. India has no DST so a fixed
 * +05:30 offset is correct and avoids pulling in a tz database. All returned
 * Dates are absolute instants (UTC under the hood) suitable for DB queries.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIst(d: Date): Date {
  return new Date(d.getTime() + IST_OFFSET_MS);
}
function fromIstParts(y: number, m: number, d: number): Date {
  // Date.UTC treats args as UTC; subtract the offset to get the true instant of IST midnight.
  return new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
}

export interface PeriodRange {
  start: Date;
  /** Exclusive. */
  end: Date;
}

export function monthRange(now: Date = new Date(), offsetMonths = 0): PeriodRange {
  const ist = toIst(now);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth() + offsetMonths;
  return { start: fromIstParts(y, m, 1), end: fromIstParts(y, m + 1, 1) };
}

/** Weeks start on Monday, which is how Indian salaried users think about "this week". */
export function weekRange(now: Date = new Date(), offsetWeeks = 0): PeriodRange {
  const ist = toIst(now);
  const dow = (ist.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const startDay = ist.getUTCDate() - dow + offsetWeeks * 7;
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  return { start: fromIstParts(y, m, startDay), end: fromIstParts(y, m, startDay + 7) };
}

export function rangeFor(period: BudgetPeriod | 'weekly' | 'monthly', now = new Date(), offset = 0): PeriodRange {
  // BudgetPeriod is a string enum whose WEEKLY member is literally 'weekly'.
  return String(period) === 'weekly' ? weekRange(now, offset) : monthRange(now, offset);
}

/** Stable key like "2026-09" or "2026-W38" used to de-dupe budget alerts. */
export function periodKey(period: BudgetPeriod, now = new Date()): string {
  const { start } = rangeFor(period, now);
  const ist = toIst(start);
  if (period === BudgetPeriod.MONTHLY) {
    return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const jan1 = Date.UTC(ist.getUTCFullYear(), 0, 1);
  const week = Math.floor((ist.getTime() - jan1) / (7 * 24 * 3600 * 1000)) + 1;
  return `${ist.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
