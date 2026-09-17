/**
 * Merchant name normalisation.
 *
 * Bank SMS and POS receipts mangle merchant names in creative ways:
 *   "SWIGGY*ORDER 1234", "AMAZON PAY INDIA PVT", "Reliance Fresh - Koramangala",
 *   "UPI-ZOMATO LTD-zomato@ptybl". We reduce these to a stable key so that
 *   grouping ("most frequent merchant"), rules and dedupe all agree.
 */

const NOISE_TOKENS = [
  'pvt', 'ltd', 'limited', 'private', 'india', 'llp', 'inc', 'corp',
  'online', 'payments', 'payment', 'pay', 'services', 'service', 'technologies', 'technology',
  'retail', 'store', 'stores', 'upi', 'pos', 'order', 'txn', 'ref', 'the',
];

/** Strip trailing UPI handles / reference numbers / branch suffixes. */
function stripReferenceNoise(input: string): string {
  return (
    input
      // UPI VPA e.g. "zomato@ptybl" or "-swiggy.rzp@hdfcbank"
      .replace(/[\w.-]+@[\w]+/g, ' ')
      // "*ORDER 1234", "#98765", "TXN12345"
      .replace(/[*#][\w-]*/g, ' ')
      .replace(/\b(?:txn|ref|order)\s*[:#-]?\s*\w+/gi, ' ')
      // Long digit runs are reference ids, not names.
      .replace(/\b\d{4,}\b/g, ' ')
  );
}

/**
 * Produce a lowercase alphanumeric key. Word boundaries are removed so that
 * "Big Basket", "BigBasket" and "BIGBASKET" all collapse to "bigbasket".
 */
export function normalizeMerchant(raw: string): string {
  const cleaned = stripReferenceNoise(raw.toLowerCase());
  const tokens = cleaned
    .split(/[^a-z0-9&]+/)
    .filter((t) => t.length > 0 && !NOISE_TOKENS.includes(t));
  return tokens.join('').replace(/&/g, '');
}

/**
 * Human-friendly display form: trims noise but keeps spacing and casing
 * sensible. Used when we have to invent a merchant label from an SMS.
 */
export function prettifyMerchant(raw: string): string {
  const cleaned = stripReferenceNoise(raw)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return raw.trim();
  // Title-case all-caps strings, leave mixed-case alone.
  if (cleaned === cleaned.toUpperCase()) {
    return cleaned
      .toLowerCase()
      .split(' ')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
  return cleaned;
}
