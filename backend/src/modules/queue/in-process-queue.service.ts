import { Injectable } from '@nestjs/common';
import { EnqueueOptions, JobHandler, QueueService } from './queue.service';

const DEFAULT_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 5_000, 30_000];

/**
 * Dev/demo queue: runs handlers on the event loop with retry + backoff.
 * Jobs are lost on process exit — acceptable for local use, and the reason
 * production must set REDIS_URL.
 */
@Injectable()
export class InProcessQueueService extends QueueService {
  private readonly handlers = new Map<string, JobHandler<unknown>>();
  private readonly pending = new Set<string>();

  register<T>(name: string, handler: JobHandler<T>): void {
    if (this.handlers.has(name)) throw new Error(`Job handler already registered: ${name}`);
    this.handlers.set(name, handler as JobHandler<unknown>);
  }

  async enqueue<T>(name: string, payload: T, opts: EnqueueOptions = {}): Promise<void> {
    const key = opts.jobId ? `${name}:${opts.jobId}` : null;
    if (key) {
      if (this.pending.has(key)) return;
      this.pending.add(key);
    }
    const attempts = opts.attempts ?? DEFAULT_ATTEMPTS;
    setTimeout(() => void this.run(name, payload, attempts, 0, key), opts.delayMs ?? 0);
  }

  private async run(name: string, payload: unknown, attempts: number, attempt: number, key: string | null) {
    const handler = this.handlers.get(name);
    if (!handler) {
      this.logger.warn(`No handler for job ${name}; dropping`);
      if (key) this.pending.delete(key);
      return;
    }
    try {
      await handler(payload);
      if (key) this.pending.delete(key);
    } catch (err) {
      const next = attempt + 1;
      if (next < attempts) {
        const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        this.logger.warn(`Job ${name} failed (attempt ${next}/${attempts}), retrying in ${wait}ms: ${String(err)}`);
        setTimeout(() => void this.run(name, payload, attempts, next, key), wait);
      } else {
        this.logger.error(`Job ${name} exhausted retries: ${err instanceof Error ? err.stack : String(err)}`);
        if (key) this.pending.delete(key);
      }
    }
  }
}
