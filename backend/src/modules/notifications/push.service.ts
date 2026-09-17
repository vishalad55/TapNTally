import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import type { Messaging } from 'firebase-admin/messaging';
import { Repository } from 'typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { NotificationDeviceEntity } from '../../database/entities';

export interface PushMessage {
  title: string;
  body: string;
  /** Deep-link payload, e.g. { screen: 'budgets', categoryId }. String values only (FCM). */
  data?: Record<string, string>;
}

/**
 * Push delivery via Firebase Cloud Messaging. When no service account is
 * configured (local dev), messages are logged instead of sent so the rest of
 * the pipeline (budget alerts, sync confirmations) is still exercised.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  // Type-only import above; firebase-admin is only *loaded* when configured.
  private messaging: Messaging | null = null;

  constructor(
    private readonly config: AppConfigService,
    @InjectRepository(NotificationDeviceEntity) private readonly devices: Repository<NotificationDeviceEntity>,
  ) {}

  async onModuleInit() {
    const path = this.config.get('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (!path) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_PATH not set — push notifications will be logged, not sent');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin') as typeof import('firebase-admin');
    const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    this.messaging = admin.messaging();
    this.logger.log('FCM initialised');
  }

  async registerDevice(userId: string, fcmToken: string, platform: 'android' | 'ios') {
    const existing = await this.devices.findOne({ where: { fcmToken } });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      return this.devices.save(existing);
    }
    return this.devices.save(this.devices.create({ userId, fcmToken, platform }));
  }

  async unregisterDevice(fcmToken: string) {
    await this.devices.delete({ fcmToken });
  }

  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    const devices = await this.devices.find({ where: { userId } });
    if (devices.length === 0) {
      this.logger.debug(`No devices for user ${userId}; skipping push "${message.title}"`);
      return;
    }
    if (!this.messaging) {
      this.logger.log(`[push:dry-run] to=${userId} devices=${devices.length} title="${message.title}" body="${message.body}"`);
      return;
    }
    const tokens = devices.map((d) => d.fcmToken);
    const res = await this.messaging.sendEachForMulticast({
      tokens,
      notification: { title: message.title, body: message.body },
      data: message.data ?? {},
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    // Prune tokens FCM says are dead so we stop paying for them.
    const dead = tokens.filter((_, i) => {
      const r = res.responses[i];
      return !r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-argument'].includes(r.error?.code ?? '');
    });
    if (dead.length) await this.devices.delete(dead.map((fcmToken) => ({ fcmToken })));
  }

  async sendToUsers(userIds: string[], message: PushMessage): Promise<void> {
    await Promise.all([...new Set(userIds)].map((id) => this.sendToUser(id, message)));
  }
}
