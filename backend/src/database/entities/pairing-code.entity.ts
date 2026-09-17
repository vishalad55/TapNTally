import { Column, Entity, Index } from 'typeorm';
import { DB } from '../db-types';
import { BaseEntity } from './base.entity';

/**
 * Short-lived code a user shows at checkout so a partner's server can route a
 * bill to their account without NFC (e.g. terminals without NFC write support).
 */
@Entity('pairing_codes')
export class PairingCodeEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  code: string;

  @Column({ type: DB.timestamp })
  expiresAt: Date;

  @Column({ type: DB.timestamp, nullable: true })
  usedAt: Date | null;
}
