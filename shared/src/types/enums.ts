/** Where a transaction came from. Drives trust/confidence UI and sync behaviour. */
export enum TransactionSource {
  /** Pulled off a POS terminal via an NFC tap. Highest confidence: itemised. */
  NFC = 'nfc',
  /** Parsed from a Gmail order-confirmation / invoice email. */
  GMAIL = 'gmail',
  /** Parsed from an Android SMS (bank debit alert or merchant confirmation). */
  SMS = 'sms',
  /** Typed in by the user. Always treated as ground truth. */
  MANUAL = 'manual',
  /** Pushed by a POS partner's server-to-server integration (future). */
  POS_PARTNER = 'pos_partner',
}

/** How the user paid. Captured when known; never guessed with confidence. */
export enum PaymentMethod {
  CARD = 'card',
  CASH = 'cash',
  UPI = 'upi',
  NET_BANKING = 'net_banking',
  WALLET = 'wallet',
  UNKNOWN = 'unknown',
}

/**
 * Canonical category slugs. Kept as a closed enum on purpose: the aggregation
 * layer (see Section 5 of the spec) needs a stable taxonomy to produce
 * comparable trend data. Users may add *custom* categories on top, which are
 * stored by id and excluded from cross-user aggregation.
 */
export enum CategorySlug {
  GROCERIES = 'groceries',
  RESTAURANTS = 'restaurants',
  SHOPPING = 'shopping',
  ELECTRONICS = 'electronics',
  TRANSPORT = 'transport',
  FUEL = 'fuel',
  BILLS_UTILITIES = 'bills_utilities',
  HEALTH = 'health',
  ENTERTAINMENT = 'entertainment',
  EDUCATION = 'education',
  TRAVEL = 'travel',
  PERSONAL_CARE = 'personal_care',
  HOME = 'home',
  GIFTS_DONATIONS = 'gifts_donations',
  FEES_CHARGES = 'fees_charges',
  UNCATEGORIZED = 'uncategorized',
}

export enum BudgetScope {
  USER = 'user',
  HOUSEHOLD = 'household',
}

export enum BudgetPeriod {
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
}

export enum ConnectionType {
  GMAIL = 'gmail',
  SMS = 'sms',
}

export enum ConnectionStatus {
  /** User has never linked this source. */
  DISCONNECTED = 'disconnected',
  /** OAuth/permission granted, first backfill still running. */
  BACKFILLING = 'backfilling',
  /** Live and syncing. */
  ACTIVE = 'active',
  /** Token expired or permission revoked — needs user re-consent. */
  NEEDS_REAUTH = 'needs_reauth',
  /** Repeated sync failures; surfaced to the user with a retry affordance. */
  ERROR = 'error',
}

export enum HouseholdRole {
  OWNER = 'owner',
  MEMBER = 'member',
}

/** Lifecycle of a single NFC tap attempt. Used for diagnostics and retry UX. */
export enum NfcTapStatus {
  SUCCESS = 'success',
  /** Phone never saw the terminal — user moved away too early. */
  NO_TAG_FOUND = 'no_tag_found',
  /** Tag read, but it isn't a TapNTally bill payload. */
  UNSUPPORTED_TERMINAL = 'unsupported_terminal',
  /** Payload present but failed schema validation or signature check. */
  MALFORMED_BILL = 'malformed_bill',
  /** NFC hardware is off or absent on this device. */
  NFC_UNAVAILABLE = 'nfc_unavailable',
  /** Bill read fine but the backend rejected/failed to store it. */
  SYNC_FAILED = 'sync_failed',
  /** User cancelled the scan sheet. */
  CANCELLED = 'cancelled',
}

/** Confidence band for an auto-assigned category. Drives the "verify this?" nudge. */
export enum CategoryConfidence {
  /** Exact merchant match or itemised NFC bill — show without a nudge. */
  HIGH = 'high',
  /** Keyword/heuristic match — show, but invite correction. */
  MEDIUM = 'medium',
  /** Fallback guess — actively ask the user to confirm. */
  LOW = 'low',
}
