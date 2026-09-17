import { ConnectionStatus, ConnectionType } from '@tapntally/shared';
import { Column, Entity, Index } from 'typeorm';
import { DB } from '../db-types';
import { BaseEntity } from './base.entity';

@Entity('connections')
@Index(['userId', 'type'], { unique: true })
export class ConnectionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 8 })
  type: ConnectionType;

  @Column({ type: 'varchar', length: 16, default: ConnectionStatus.DISCONNECTED })
  status: ConnectionStatus;

  /** AES-GCM encrypted JSON of OAuth tokens. Null for SMS (device-side permission only). */
  @Column({ type: 'text', nullable: true })
  encryptedTokens: string | null;

  /** Gmail incremental-sync cursor. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  gmailHistoryId: string | null;

  /** When the Gmail push `watch` expires (max 7 days) — renewed by cron. */
  @Column({ type: DB.timestamp, nullable: true })
  gmailWatchExpiresAt: Date | null;

  @Column({ type: DB.timestamp, nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  importedCount: number;

  @Column({ type: 'integer', default: 0 })
  consecutiveFailures: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  lastError: string | null;
}
