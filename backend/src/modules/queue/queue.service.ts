import { Logger } from '@nestjs/common';

export type JobHandler<T = unknown> = (payload: T) => Promise<void>;

export interface EnqueueOptions {
  /** Delay before first attempt. */
  delayMs?: number;
  /** Stable id — enqueueing the same id twice is a no-op while the first is pending. */
  jobId?: string;
  attempts?: number;
}

/**
 * Background job abstraction. Two drivers:
 *  - InProcessQueueService: setTimeout + retry, for dev/demo (no Redis).
 *  - BullMqQueueService:    Redis-backed, horizontally scalable, for prod.
 *
 * Modules register handlers in `onModuleInit` and enqueue from services.
 * Handlers must be idempotent — both drivers retry on failure.
 */
export abstract class QueueService {
  protected readonly logger = new Logger(QueueService.name);
  abstract register<T>(name: string, handler: JobHandler<T>): void;
  abstract enqueue<T>(name: string, payload: T, opts?: EnqueueOptions): Promise<void>;
}

export const JOBS = {
  BUDGET_CHECK: 'budget.check',
  GMAIL_BACKFILL: 'gmail.backfill',
  GMAIL_SYNC: 'gmail.sync',
  GMAIL_RENEW_WATCH: 'gmail.renewWatch',
} as const;

export interface BudgetCheckJob {
  userId: string;
  householdId: string | null;
  categoryId: string;
}
export interface GmailJob {
  connectionId: string;
}
