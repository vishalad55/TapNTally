/**
 * Money handling for TapNTally.
 *
 * All monetary amounts in this system are stored and transported as **integer
 * paise** (1 INR = 100 paise). Floating point rupees are never persisted or sent
 * over the wire — accumulating float error across a month of transactions
 * produces totals that don't reconcile with a user's bank statement, which is
 * fatal for a trust-first expense tracker.
 *
 * Convention: any field named `*Paise` or `amountPaise` is an integer.
 */

export const PAISE_PER_RUPEE = 100;

/** Convert a rupee value (e.g. from a user-facing input) into integer paise. */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new RangeError(`Cannot convert non-finite value to paise: ${rupees}`);
  }
  // Round rather than truncate: 19.99 * 100 === 1998.9999999999998 in IEEE-754.
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** Convert integer paise back into a rupee number. Presentation only. */
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/**
 * Format paise as an Indian-locale currency string, e.g. 12345678 -> "₹1,23,456.78".
 * Uses the en-IN lakh/crore grouping, which is what Indian users expect.
 */
export function formatPaise(
  paise: number,
  options: { showDecimals?: boolean; compact?: boolean } = {},
): string {
  const { showDecimals = true, compact = false } = options;
  const rupees = paiseToRupees(paise);

  if (compact) {
    const abs = Math.abs(rupees);
    if (abs >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)}Cr`;
    if (abs >= 100_000) return `₹${(rupees / 100_000).toFixed(2)}L`;
    if (abs >= 1_000) return `₹${(rupees / 1_000).toFixed(1)}K`;
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(rupees);
}

/**
 * Parse a rupee amount out of free text found in an SMS or email body.
 * Handles the many shapes Indian merchants and banks use:
 *   "Rs. 1,234.50", "INR 1234", "₹1,23,456.78", "Rs 499/-"
 * Returns integer paise, or null when no amount is present.
 */
export function parseAmountToPaise(text: string): number | null {
  const patterns = [
    /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:₹|rs\.?|inr|rupees)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const normalized = match[1].replace(/,/g, '');
      const value = Number.parseFloat(normalized);
      if (Number.isFinite(value) && value >= 0) {
        return rupeesToPaise(value);
      }
    }
  }
  return null;
}
