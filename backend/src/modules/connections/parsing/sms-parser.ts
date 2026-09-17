import { PaymentMethod, parseAmountToPaise, prettifyMerchant } from '@tapntally/shared';

/**
 * Bank / merchant SMS → purchase. Pure, deterministic, heavily tested —
 * this is the most fragile surface in the product and the tests in
 * `sms-parser.spec.ts` are the regression net for every new bank format.
 *
 * We only ever keep the *extracted fields*; the SMS body is never persisted.
 */
export interface ParsedSms {
  amountPaise: number;
  merchant: string;
  paymentMethod: PaymentMethod;
  occurredAt: Date | null;
  /** Bank/UPI reference when present; helps dedupe against Gmail/NFC copies. */
  reference: string | null;
}

/** Anything matching these is not a purchase we should record. */
const REJECT_PATTERNS: RegExp[] = [
  /\botp\b/i,
  /one[- ]time password/i,
  /\bcredited\b(?!.*\bdebited\b)/i, // pure credit alerts (salary, refunds)
  /\brefund/i,
  /\breversed\b/i,
  /\bfailed\b/i,
  /\bdeclined\b/i,
  /\bavailable balance is\b/i,
  /\bavl bal\b/i,
  /\bemi due\b/i,
  /\bdue on\b/i,
  /\bminimum amount due\b/i,
  /\bstatement\b/i,
  /\boffer\b/i,
  /\bcashback\b/i,
  /\bwill be debited\b/i, // autopay pre-notification, not a debit
  /\brequested\b.*\bpayment\b/i, // UPI collect request
  /\bloan\b/i,
];

/** A debit must be signalled by one of these. */
const DEBIT_PATTERNS: RegExp[] = [
  /\bdebited\b/i,
  /\bspent\b/i,
  /\bpaid\b/i,
  /\bpayment of\b/i,
  /\bpurchase of\b/i,
  /\btxn of\b/i,
  /\btransaction of\b/i,
  /\bsent\b.*\bto\b/i,
  /\bcharged\b/i,
];

const MERCHANT_PATTERNS: RegExp[] = [
  // "... to VPA swiggy.rzp@hdfcbank ..." / "... to swiggy@ybl"
  /\bto\s+(?:vpa\s+)?([a-z0-9._-]+@[a-z0-9]+)/i,
  // "... at RELIANCE FRESH on ..." / "at AMAZON PAY INDIA. Avl"
  /\bat\s+([A-Za-z][A-Za-z0-9&'._ -]{2,60}?)(?=\s+on\b|\s+via\b|\s+using\b|\s+ref\b|\s*\.|,|\s+avl\b|\s+total\b|$)/i,
  // "... to ZOMATO LTD on ..." / "credited to XYZ"
  /\b(?:to|towards|credited to)\s+(?:mr\.?|ms\.?|m\/s\.?)?\s*([A-Za-z][A-Za-z0-9&'._ -]{2,60}?)(?=\s+on\b|\s+via\b|\s+using\b|\s+ref\b|\s*\.|,|\s+upi\b|$)/i,
  // "... for Zomato order" / "Info: Swiggy"
  /\b(?:info|for|merchant)[:\s]+([A-Za-z][A-Za-z0-9&'._ -]{2,40}?)(?=\s+on\b|\s*\.|,|$)/i,
];

const REFERENCE_PATTERN = /\b(?:upi\s*ref(?:erence)?(?:\s*no)?|ref(?:erence)?\s*(?:no|id)?|rrn|txn\s*(?:id|no)?)[:.\s#-]*([A-Za-z0-9]{6,20})\b/i;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function parseDate(text: string, fallbackYear: number): Date | null {
  // Order matters: most specific first.
  const patterns: Array<{ re: RegExp; build: (m: RegExpMatchArray) => Date | null }> = [
    // 2026-09-12, 2026-09-12:14:05:11
    { re: /\b(20\d{2})-(\d{2})-(\d{2})(?:[:T ](\d{2}):(\d{2}))?/, build: (m) => ist(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0) },
    // 12-09-2026, 12/09/26, 12-09-26
    { re: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b(?:[ ,]+(?:at\s+)?(\d{1,2}):(\d{2}))?/, build: (m) => ist(year(m[3], fallbackYear), +m[2] - 1, +m[1], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0) },
    // 12Sep26, 12-Sep-2026, 12 Sep 2026, 12Sept26
    { re: /\b(\d{1,2})[ -]?([A-Za-z]{3,4})[ -]?(\d{2,4})\b(?:[ ,]+(?:at\s+)?(\d{1,2}):(\d{2}))?/, build: (m) => {
      const mo = MONTHS[m[2].toLowerCase()];
      return mo === undefined ? null : ist(year(m[3], fallbackYear), mo, +m[1], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0);
    } },
  ];
  for (const { re, build } of patterns) {
    const m = text.match(re);
    if (m) {
      const d = build(m);
      if (d && !Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function year(raw: string, fallback: number): number {
  if (raw.length === 4) return +raw;
  if (raw.length === 2) return 2000 + +raw;
  return fallback;
}
/** Construct an IST wall-clock time as an absolute instant. */
function ist(y: number, mo: number, d: number, h: number, mi: number): Date {
  return new Date(Date.UTC(y, mo, d, h, mi) - 5.5 * 3600 * 1000);
}

function paymentMethodFrom(text: string): PaymentMethod {
  const t = text.toLowerCase();
  if (/\bupi\b|\bvpa\b|@[a-z]+\b/.test(t)) return PaymentMethod.UPI;
  if (/\bcredit card\b|\bdebit card\b|\bcard\b|\bxx\d{4}\b.*\bat\b/.test(t)) return PaymentMethod.CARD;
  if (/\bnet ?banking\b|\bneft\b|\bimps\b|\brtgs\b/.test(t)) return PaymentMethod.NET_BANKING;
  if (/\bwallet\b|\bpaytm balance\b/.test(t)) return PaymentMethod.WALLET;
  return PaymentMethod.UNKNOWN;
}

function merchantFromVpa(vpa: string): string {
  const handle = vpa.split('@')[0];
  // "swiggy.rzp" → "swiggy", "zomato-order" → "zomato", "paytm-12345" → "paytm"
  const first = handle.split(/[.\-_]/).find((p) => /[a-z]{3,}/i.test(p)) ?? handle;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function parseSms(body: string, receivedAt: Date = new Date()): ParsedSms | null {
  const text = body.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (REJECT_PATTERNS.some((re) => re.test(text))) return null;
  if (!DEBIT_PATTERNS.some((re) => re.test(text))) return null;

  const amountPaise = parseAmountToPaise(text);
  if (amountPaise === null || amountPaise <= 0) return null;

  let merchant: string | null = null;
  for (const re of MERCHANT_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      const candidate = m[1].trim();
      // Skip account-number style captures ("A/c XX1234") and bare bank names.
      if (/^(a\/c|ac|account|your|bank)\b/i.test(candidate)) continue;
      merchant = candidate.includes('@') ? merchantFromVpa(candidate) : prettifyMerchant(candidate);
      break;
    }
  }
  if (!merchant) return null;

  const refMatch = text.match(REFERENCE_PATTERN);
  return {
    amountPaise,
    merchant,
    paymentMethod: paymentMethodFrom(text),
    occurredAt: parseDate(text, receivedAt.getFullYear()),
    reference: refMatch?.[1] ?? null,
  };
}
