import {
  KNOWN_SENDER_DOMAINS,
  PURCHASE_SUBJECT_KEYWORDS,
  PaymentMethod,
  TransactionItem,
  parseAmountToPaise,
  rupeesToPaise,
} from '@tapntally/shared';

/**
 * Order-confirmation / invoice email → purchase. Pure and tested.
 *
 * Input is already reduced to text; nothing here retains the body. The
 * caller stores only the returned fields plus the Gmail message id.
 */
export interface EmailInput {
  messageId: string;
  from: string;
  subject: string;
  /** Plain text (HTML already stripped). */
  body: string;
  receivedAt: Date;
}

export interface ParsedEmail {
  amountPaise: number;
  merchant: string;
  orderId: string | null;
  items: TransactionItem[];
  paymentMethod: PaymentMethod;
}

/** Friendly names for well-known sender domains. */
const DOMAIN_NAMES: Record<string, string> = {
  'amazon.in': 'Amazon', 'amazon.com': 'Amazon', 'flipkart.com': 'Flipkart', 'myntra.com': 'Myntra',
  'ajio.com': 'AJIO', 'meesho.com': 'Meesho', 'nykaa.com': 'Nykaa', 'tatacliq.com': 'Tata CLiQ',
  'bigbasket.com': 'BigBasket', 'blinkit.com': 'Blinkit', 'zepto.com': 'Zepto', 'zeptonow.com': 'Zepto',
  'swiggy.in': 'Swiggy', 'swiggy.com': 'Swiggy', 'zomato.com': 'Zomato', 'bookmyshow.com': 'BookMyShow',
  'makemytrip.com': 'MakeMyTrip', 'goibibo.com': 'Goibibo', 'cleartrip.com': 'Cleartrip', 'ixigo.com': 'ixigo',
  'irctc.co.in': 'IRCTC', 'uber.com': 'Uber', 'olacabs.com': 'Ola', 'croma.com': 'Croma',
  'reliancedigital.in': 'Reliance Digital', 'pharmeasy.in': 'PharmEasy', '1mg.com': 'Tata 1mg',
  'apollopharmacy.in': 'Apollo Pharmacy', 'dominos.co.in': "Domino's", 'pepperfry.com': 'Pepperfry',
  'urbancompany.com': 'Urban Company', 'lenskart.com': 'Lenskart', 'decathlon.in': 'Decathlon',
};

const NEGATIVE_SUBJECT = /\b(cancel+ed|refund|returned|return request|failed|unsuccessful|reminder|wishlist|back in stock|price drop|recommend|newsletter|deal|sale|offer)\b/i;

/** Lines that name the authoritative total, tried in priority order. */
const TOTAL_PATTERNS: RegExp[] = [
  /(?:grand\s*total|order\s*total|total\s*amount|amount\s*paid|total\s*paid|you\s*paid|amount\s*payable|net\s*payable|total\s*fare|bill\s*total)\s*[:-]?\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
  /\btotal\s*[:-]?\s*(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
  /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:paid|charged|debited)/i,
];

const ORDER_ID_PATTERN = /\border\s*(?:id|no\.?|number|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{5,30})\b/i;

export function senderDomain(from: string): string | null {
  const m = from.match(/@([a-z0-9.-]+)/i);
  if (!m) return null;
  const host = m[1].toLowerCase();
  // Strip mail subdomains: "order-update.amazon.in" → "amazon.in"; keep ".co.in" intact.
  const parts = host.split('.');
  if (parts.length > 2 && parts[parts.length - 2] === 'co') return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

/** Cheap pre-filter run before fetching full bodies during backfill. */
export function looksLikePurchase(from: string, subject: string): boolean {
  if (NEGATIVE_SUBJECT.test(subject)) return false;
  const domain = senderDomain(from);
  const knownSender = domain !== null && KNOWN_SENDER_DOMAINS.includes(domain);
  const subj = subject.toLowerCase();
  const keyword = PURCHASE_SUBJECT_KEYWORDS.some((k) => subj.includes(k));
  return knownSender ? keyword || /\border|invoice|receipt|booking|ticket|payment\b/i.test(subject) : keyword;
}

/** Best-effort line-item extraction from plain text: "Item name  x2  ₹1,299". */
function extractItems(body: string): TransactionItem[] {
  const items: TransactionItem[] = [];
  const re = /^(.{3,80}?)\s+(?:x\s*|qty[:\s]*)(\d{1,3})\s+(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) && items.length < 50) {
    const qty = +m[2];
    const total = rupeesToPaise(+m[3].replace(/,/g, ''));
    items.push({ name: m[1].trim(), qty, unitPaise: qty > 0 ? Math.round(total / qty) : total, totalPaise: total });
  }
  return items;
}

export function parseEmail(input: EmailInput): ParsedEmail | null {
  if (!looksLikePurchase(input.from, input.subject)) return null;

  const domain = senderDomain(input.from);
  const merchant =
    (domain && DOMAIN_NAMES[domain]) ||
    input.from.replace(/<.*>/, '').replace(/["']/g, '').trim() ||
    domain ||
    'Unknown';

  const text = `${input.subject}\n${input.body}`;
  let amountPaise: number | null = null;
  for (const re of TOTAL_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      amountPaise = rupeesToPaise(Number.parseFloat(m[1].replace(/,/g, '')));
      break;
    }
  }
  if (amountPaise === null) amountPaise = parseAmountToPaise(input.subject) ?? parseAmountToPaise(input.body);
  if (amountPaise === null || amountPaise <= 0) return null;

  const orderId = text.match(ORDER_ID_PATTERN)?.[1] ?? null;
  const lower = text.toLowerCase();
  const paymentMethod = /\bupi\b/.test(lower)
    ? PaymentMethod.UPI
    : /\bcash on delivery\b|\bcod\b/.test(lower)
      ? PaymentMethod.CASH
      : /\bcard\b/.test(lower)
        ? PaymentMethod.CARD
        : /\bnet ?banking\b/.test(lower)
          ? PaymentMethod.NET_BANKING
          : /\bwallet\b/.test(lower)
            ? PaymentMethod.WALLET
            : PaymentMethod.UNKNOWN;

  return { amountPaise, merchant, orderId, items: extractItems(input.body), paymentMethod };
}

/** Minimal HTML → text. Good enough for order emails; not a general converter. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#8377;|&#x20b9;|&#x20B9;/g, '₹')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}
