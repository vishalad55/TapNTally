import { Body, Controller, HttpCode, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AppConfigService } from '../../config/app-config.service';
import { ConnectionsService } from './connections.service';

interface PubSubPush {
  message?: { data?: string; messageId?: string };
  subscription?: string;
}

/**
 * Google Pub/Sub push endpoint for Gmail `users.watch` notifications.
 * Registered outside the /api/v1 prefix (see main.ts). Always returns 2xx
 * promptly so Pub/Sub doesn't retry-storm; the actual sync runs on the queue.
 */
@ApiExcludeController()
@Controller('webhooks/gmail')
export class GmailWebhookController {
  private readonly logger = new Logger(GmailWebhookController.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly connections: ConnectionsService,
  ) {}

  @Post()
  @HttpCode(204)
  async receive(@Query('token') token: string | undefined, @Body() body: PubSubPush) {
    const expected = this.config.get('GMAIL_WEBHOOK_TOKEN');
    if (!expected || token !== expected) throw new UnauthorizedException();

    const data = body?.message?.data;
    if (!data) return;
    try {
      const payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as { emailAddress?: string };
      if (payload.emailAddress) await this.connections.onGmailPush(payload.emailAddress);
    } catch (err) {
      this.logger.warn(`Ignoring malformed Pub/Sub message: ${String(err)}`);
    }
  }
}
