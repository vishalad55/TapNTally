import { HouseholdRole } from '@tapntally/shared';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { DB } from '../db-types';
import { BaseEntity } from './base.entity';
import { HouseholdEntity } from './household.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  avatarUrl: string | null;

  /** Google `sub` claim. Null for dev-login users. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  googleSub: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  householdId: string | null;

  @ManyToOne(() => HouseholdEntity, (h) => h.members, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'householdId' })
  household: HouseholdEntity | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  householdRole: HouseholdRole | null;

  @Column({ type: DB.timestamp, nullable: true })
  householdJoinedAt: Date | null;

  /** Explicit opt-in for anonymised aggregate reporting. Default off. */
  @Column({ type: 'boolean', default: false })
  aggregateInsightsConsent: boolean;

  @Column({ type: DB.timestamp, nullable: true })
  lastSeenAt: Date | null;
}
