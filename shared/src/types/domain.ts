import {
  BudgetPeriod,
  BudgetScope,
  CategoryConfidence,
  CategorySlug,
  ConnectionStatus,
  ConnectionType,
  HouseholdRole,
  PaymentMethod,
  TransactionSource,
} from './enums';

/** ISO-8601 string. All timestamps cross the wire as strings. */
export type IsoDateString = string;
export type Uuid = string;

export interface User {
  id: Uuid;
  email: string;
  name: string;
  avatarUrl: string | null;
  householdId: Uuid | null;
  householdRole: HouseholdRole | null;
  /** Whether the user has opted in to anonymised aggregate reporting. */
  aggregateInsightsConsent: boolean;
  createdAt: IsoDateString;
}

export interface Category {
  id: Uuid;
  /** Null for user-defined custom categories. */
  slug: CategorySlug | null;
  name: string;
  /** Emoji or icon token used by the mobile app. */
  icon: string;
  /** Hex colour used consistently across charts and progress bars. */
  color: string;
  isCustom: boolean;
  /** Owner of a custom category; null for canonical ones. */
  userId: Uuid | null;
}

export interface TransactionItem {
  name: string;
  qty: number;
  unitPaise: number;
  totalPaise: number;
  sku?: string;
}

export interface Transaction {
  id: Uuid;
  userId: Uuid;
  householdId: Uuid | null;
  source: TransactionSource;
  merchant: string;
  /** Normalised merchant key used for grouping (e.g. "swiggy"). */
  merchantKey: string;
  amountPaise: number;
  currency: 'INR';
  categoryId: Uuid;
  category: Category;
  categoryConfidence: CategoryConfidence;
  /** True once the user has manually set/confirmed the category. */
  categoryConfirmed: boolean;
  paymentMethod: PaymentMethod;
  items: TransactionItem[];
  isShared: boolean;
  tags: string[];
  notes: string | null;
  /** Opaque reference into the source system (bill id / message id). Never raw content. */
  rawSourceRef: string | null;
  /** When the purchase actually happened. */
  occurredAt: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Budget {
  id: Uuid;
  scope: BudgetScope;
  /** userId for USER scope, householdId for HOUSEHOLD scope. */
  ownerId: Uuid;
  categoryId: Uuid;
  category: Category;
  limitPaise: number;
  period: BudgetPeriod;
  /** Threshold (0-1) at which we push a warning. Default 0.8. */
  alertThreshold: number;
  createdAt: IsoDateString;
}

export interface BudgetProgress {
  budget: Budget;
  spentPaise: number;
  /** spent / limit, may exceed 1. */
  ratio: number;
  status: 'ok' | 'warning' | 'exceeded';
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
}

export interface Household {
  id: Uuid;
  name: string;
  inviteCode: string;
  members: HouseholdMember[];
  createdAt: IsoDateString;
}

export interface HouseholdMember {
  userId: Uuid;
  name: string;
  avatarUrl: string | null;
  role: HouseholdRole;
  joinedAt: IsoDateString;
}

export interface Connection {
  id: Uuid;
  userId: Uuid;
  type: ConnectionType;
  status: ConnectionStatus;
  lastSyncedAt: IsoDateString | null;
  /** Count of transactions ingested from this source, for the settings UI. */
  importedCount: number;
  lastError: string | null;
}

export interface CategorySpend {
  category: Category;
  amountPaise: number;
  transactionCount: number;
  /** Share of total in this period, 0-1. */
  share: number;
}

export interface SpendSummary {
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
  totalPaise: number;
  byCategory: CategorySpend[];
}

export interface Recap {
  period: 'weekly' | 'monthly';
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
  totalPaise: number;
  previousTotalPaise: number;
  /** (total - previous) / previous; null when previous is zero. */
  changeRatio: number | null;
  biggestIncrease: { category: Category; deltaPaise: number } | null;
  biggestSaving: { category: Category; deltaPaise: number } | null;
  topMerchant: { merchant: string; count: number; amountPaise: number } | null;
  priciestPurchase: Transaction | null;
  /** Ready-to-render one-liner, e.g. "You spent 12% less on eating out. Chef's kiss." */
  headline: string;
  highlights: string[];
}
