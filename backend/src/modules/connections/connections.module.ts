import { Module } from '@nestjs/common';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { GmailSyncService } from './gmail-sync.service';
import { GmailWebhookController } from './gmail-webhook.controller';
import { GmailClient } from './gmail.client';

@Module({
  providers: [ConnectionsService, GmailClient, GmailSyncService],
  controllers: [ConnectionsController, GmailWebhookController],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
