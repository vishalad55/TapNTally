import { MERCHANT_RULES } from '../constants/merchant-rules';
import { CategoryConfidence, CategorySlug } from '../types/enums';
import { normalizeMerchant } from './merchant';

export interface CategorizationInput {
  merchant: string;
  /** Itemised line names when available (NFC bills). Improves recall. */
  itemNames?: string[];
  /** ISO 18245 Merchant Category Code from the terminal, when present. */
  mcc?: string;
  /** Free text (SMS/email body) as a last resort. */
  context?: string;
}

export interface CategorizationResult {
  slug: CategorySlug;
  confidence: CategoryConfidence;
  /** Why we picked this — surfaced in debug tooling and useful for future ML labelling. */
  reason: string;
}

/**
 * MCC → category. Coarse but authoritative when a terminal supplies it.
 * Ranges per ISO 18245 / card network conventions.
 */
function categoryFromMcc(mcc: string): CategorySlug | null {
  const code = Number.parseInt(mcc, 10);
  if (!Number.isFinite(code)) return null;
  if (code === 5411 || code === 5499 || code === 5422 || code === 5441) return CategorySlug.GROCERIES;
  if (code >= 5811 && code <= 5814) return CategorySlug.RESTAURANTS;
  if (code === 5541 || code === 5542 || code === 5983) return CategorySlug.FUEL;
  if (code === 5732 || code === 5045 || code === 5065) return CategorySlug.ELECTRONICS;
  if ((code >= 5611 && code <= 5699) || code === 5311 || code === 5310 || code === 5331 || code === 5399 || code === 5651)
    return CategorySlug.SHOPPING;
  if (code === 4121 || code === 4111 || code === 4131 || code === 4112 || code === 7523 || code === 4784)
    return CategorySlug.TRANSPORT;
  if ((code >= 3000 && code <= 3299) || code === 4511 || (code >= 3501 && code <= 3999) || code === 7011 || code === 4722)
    return CategorySlug.TRAVEL;
  if (code === 4900 || code === 4814 || code === 4899 || code === 4816) return CategorySlug.BILLS_UTILITIES;
  if (code === 5912 || code === 8011 || code === 8021 || code === 8062 || code === 8071 || code === 8099 || code === 7997)
    return CategorySlug.HEALTH;
  if (code === 7832 || code === 7841 || code === 7922 || code === 7929 || code === 7994 || code === 7996) return CategorySlug.ENTERTAINMENT;
  if (code === 8211 || code === 8220 || code === 8299 || code === 5942 || code === 5943) return CategorySlug.EDUCATION;
  if (code === 7230 || code === 7298 || code === 5977) return CategorySlug.PERSONAL_CARE;
  if (code === 5712 || code === 5719 || code === 5200 || code === 5251 || code === 5722) return CategorySlug.HOME;
  if (code === 5992 || code === 5947 || code === 8398 || code === 8661) return CategorySlug.GIFTS_DONATIONS;
  return null;
}

/**
 * Deterministic, explainable categorisation. Order of precedence:
 *   1. MCC from terminal        → HIGH
 *   2. Known merchant key       → HIGH
 *   3. Keyword in merchant name → MEDIUM
 *   4. Keyword in item names    → MEDIUM
 *   5. Keyword in free context  → LOW
 *   6. Fallback                 → LOW, uncategorised
 *
 * Pure function, no I/O, so both the app (optimistic UI) and backend
 * (source of truth) can run the identical logic.
 */
export function categorize(input: CategorizationInput): CategorizationResult {
  if (input.mcc) {
    const fromMcc = categoryFromMcc(input.mcc);
    if (fromMcc) return { slug: fromMcc, confidence: CategoryConfidence.HIGH, reason: `mcc:${input.mcc}` };
  }

  const key = normalizeMerchant(input.merchant);
  for (const rule of MERCHANT_RULES) {
    for (const m of rule.merchants ?? []) {
      // Prefix match handles "swiggyinstamart" vs "swiggy" ordering via rule order,
      // and "amazonpay" → amazon. Require the key to *start* with the merchant to avoid
      // "ola" matching "chocolates".
      if (key === m || key.startsWith(m)) {
        return { slug: rule.category, confidence: CategoryConfidence.HIGH, reason: `merchant:${m}` };
      }
    }
  }

  const merchantLower = input.merchant.toLowerCase();
  for (const rule of MERCHANT_RULES) {
    for (const kw of rule.keywords ?? []) {
      if (merchantLower.includes(kw)) {
        return { slug: rule.category, confidence: CategoryConfidence.MEDIUM, reason: `keyword:${kw}` };
      }
    }
  }

  const itemsText = (input.itemNames ?? []).join(' ').toLowerCase();
  if (itemsText) {
    for (const rule of MERCHANT_RULES) {
      for (const kw of rule.keywords ?? []) {
        if (itemsText.includes(kw)) {
          return { slug: rule.category, confidence: CategoryConfidence.MEDIUM, reason: `item:${kw}` };
        }
      }
    }
  }

  const context = (input.context ?? '').toLowerCase();
  if (context) {
    for (const rule of MERCHANT_RULES) {
      for (const kw of rule.keywords ?? []) {
        if (context.includes(kw)) {
          return { slug: rule.category, confidence: CategoryConfidence.LOW, reason: `context:${kw}` };
        }
      }
    }
  }

  return { slug: CategorySlug.UNCATEGORIZED, confidence: CategoryConfidence.LOW, reason: 'fallback' };
}
