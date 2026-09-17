import { Column, Entity, Index } from 'typeorm';
import { DB } from '../db-types';
import { BaseEntity } from './base.entity';

/** Refresh tokens are stored hashed; the raw token exists only on the device. */
@Entity('refresh_tokens')
export class RefreshTokenEntity extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: DB.timestamp })
  expiresAt: Date;

  @Column({ type: DB.timestamp, nullable: true })
  revokedAt: Date | null;

  /** Set when this token was exchanged; lets us detect replay of a rotated token. */
  @Column({ type: 'uuid', nullable: true })
  replacedById: string | null;
}
