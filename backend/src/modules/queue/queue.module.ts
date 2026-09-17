import { Global, Logger, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { BullMqQueueService } from './bullmq-queue.service';
import { InProcessQueueService } from './in-process-queue.service';
import { QueueService } from './queue.service';

@Global()
@Module({
  providers: [
    {
      provide: QueueService,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): QueueService => {
        const redisUrl = config.get('REDIS_URL');
        if (redisUrl) {
          new Logger('QueueModule').log('Using BullMQ queue (Redis)');
          return new BullMqQueueService(redisUrl);
        }
        new Logger('QueueModule').warn('REDIS_URL not set — using in-process queue (dev only)');
        return new InProcessQueueService();
      },
    },
  ],
  exports: [QueueService],
})
export class QueueModule {}
