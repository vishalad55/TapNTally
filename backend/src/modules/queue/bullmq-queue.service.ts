import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { EnqueueOptions, JobHandler, QueueService } from './queue.service';

/** Production queue backed by Redis. One BullMQ queue + worker per job name. */
@Injectable()
export class BullMqQueueService extends QueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  constructor(redisUrl: string) {
    super();
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }

  register<T>(name: string, handler: JobHandler<T>): void {
    const worker = new Worker(name, async (job) => handler(job.data as T), {
      connection: this.connection,
      concurrency: 5,
    });
    worker.on('failed', (job, err) =>
      this.logger.error(`Job ${name}#${job?.id} failed: ${err.message}`),
    );
    this.workers.push(worker);
  }

  async enqueue<T>(name: string, payload: T, opts: EnqueueOptions = {}): Promise<void> {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection });
      this.queues.set(name, queue);
    }
    await queue.add(name, payload, {
      jobId: opts.jobId,
      delay: opts.delayMs,
      attempts: opts.attempts ?? 5,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    this.connection.disconnect();
  }
}
