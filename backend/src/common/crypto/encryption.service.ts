import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service';

/**
 * AES-256-GCM envelope for secrets at rest (Gmail refresh tokens, terminal
 * HMAC secrets). Output format: base64(iv | authTag | ciphertext), version-
 * prefixed so the key can be rotated later without a big-bang migration.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: AppConfigService) {
    this.key = Buffer.from(config.get('ENCRYPTION_KEY'), 'base64');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${Buffer.concat([iv, tag, ct]).toString('base64')}`;
  }

  decrypt(payload: string): string {
    const [version, data] = payload.split(':');
    if (version !== 'v1' || !data) throw new Error('Unsupported ciphertext format');
    const buf = Buffer.from(data, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }

  /** HMAC-SHA256 hex — used for refresh-token hashing and TBEF signatures. */
  hmac(secret: string | Buffer, data: string): string {
    return createHmac('sha256', secret).update(data).digest('base64');
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }
}
