import { BudgetPeriod } from '@tapntally/shared';
import { monthRange, periodKey, weekRange } from './period';

describe('period (IST)', () => {
  // 2026-09-17T13:05 IST == 07:35Z
  const now = new Date('2026-09-17T07:35:00Z');

  it('month range starts at IST midnight on the 1st', () => {
    const r = monthRange(now);
    expect(r.start.toISOString()).toBe('2026-08-31T18:30:00.000Z'); // 1 Sep 00:00 IST
    expect(r.end.toISOString()).toBe('2026-09-30T18:30:00.000Z'); // 1 Oct 00:00 IST
  });

  it('previous month via offset', () => {
    const r = monthRange(now, -1);
    expect(r.start.toISOString()).toBe('2026-07-31T18:30:00.000Z');
    expect(r.end.toISOString()).toBe('2026-08-31T18:30:00.000Z');
  });

  it('week range starts Monday IST', () => {
    // 17 Sep 2026 is a Thursday → week starts Mon 14 Sep
    const r = weekRange(now);
    expect(r.start.toISOString()).toBe('2026-09-13T18:30:00.000Z');
    expect(r.end.toISOString()).toBe('2026-09-20T18:30:00.000Z');
  });

  it('handles the UTC/IST date boundary', () => {
    // 21:00Z on 30 Sep is already 1 Oct 02:30 IST → October
    const r = monthRange(new Date('2026-09-30T21:00:00Z'));
    expect(r.start.toISOString()).toBe('2026-09-30T18:30:00.000Z');
  });

  it('period keys are stable', () => {
    expect(periodKey(BudgetPeriod.MONTHLY, now)).toBe('2026-09');
    expect(periodKey(BudgetPeriod.WEEKLY, now)).toMatch(/^2026-W\d{2}$/);
  });
});
