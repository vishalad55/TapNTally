import { BudgetPeriod, BudgetScope, PaymentMethod, TransactionSource } from './enums';
import { TbefBill } from './nfc';
import { TransactionItem } from './domain';

/** Standard envelope for list endpoints. */
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export interface ApiError {
  statusCode: number;
  /** Stable machine-readable code, e.g. "NFC_MALFORMED_BILL". */
  code: string;
  message: string;
  details?: unknown;
}

// ---- Auth ----
export interface GoogleSignInRequest {
  /** Google ID token from the native sign-in SDK. */
  idToken: string;
}
export interface DevSignInRequest {
  /** Dev-only: sign in as a seeded demo user by email. Disabled in production. */
  email: string;
}
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}
export interface RefreshRequest {
  refreshToken: string;
}

// ---- Transactions ----
export interface CreateManualTransactionRequest {
  merchant: string;
  amountPaise: number;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  occurredAt?: string;
  items?: TransactionItem[];
  isShared?: boolean;
  tags?: string[];
  notes?: string;
}

export interface UpdateTransactionRequest {
  categoryId?: string;
  tags?: string[];
  notes?: string | null;
  isShared?: boolean;
  merchant?: string;
  amountPaise?: number;
  occurredAt?: string;
  paymentMethod?: PaymentMethod;
}

export interface TransactionQuery {
  /** Merchant-name prefix/substring search, case-insensitive. */
  q?: string;
  categoryIds?: string[];
  sources?: TransactionSource[];
  paymentMethods?: PaymentMethod[];
  minPaise?: number;
  maxPaise?: number;
  from?: string;
  to?: string;
  /** "shared" = household view; "personal" = only mine; "all" = default. */
  scope?: 'personal' | 'shared' | 'all';
  cursor?: string;
  limit?: number;
}

// ---- NFC ----
export interface NfcIngestRequest {
  bill: TbefBill;
  /** Client-generated idempotency key so a retried tap never double-posts. */
  idempotencyKey: string;
}

// ---- Budgets ----
export interface UpsertBudgetRequest {
  scope: BudgetScope;
  categoryId: string;
  limitPaise: number;
  period?: BudgetPeriod;
  alertThreshold?: number;
}

// ---- Households ----
export interface CreateHouseholdRequest {
  name: string;
}
export interface JoinHouseholdRequest {
  inviteCode: string;
}

// ---- Connections ----
export interface ConnectGmailRequest {
  /** Google OAuth authorization code from the mobile consent flow. */
  authCode: string;
}
/** Batch of SMS messages forwarded from the Android client for parsing. */
export interface SmsIngestRequest {
  messages: Array<{
    /** Client-side stable id (Android _id) — used for dedupe. */
    id: string;
    sender: string;
    body: string;
    receivedAt: string;
  }>;
}
export interface SmsIngestResponse {
  parsed: number;
  skipped: number;
  duplicates: number;
}
