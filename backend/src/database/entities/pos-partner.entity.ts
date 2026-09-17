import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/** A partner organisation (Paytm, Pine Labs, HDFC…) allowed to push bills via API. */
@Entity('pos_partners')
export class PosPartnerEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  network: string;

  @Column({ type: 'varchar', length: 120 })
  displayName: string;

  /** SHA-256 hash of the partner API key. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  apiKeyHash: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
