import {
  CategoryConfidence,
  PaymentMethod,
  TransactionItem,
  TransactionSource,
} from '@tapntally/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DB } from '../db-types';
import { BaseEntity } from './base.entity';
import { CategoryEntity } from './category.entity';
import { UserEntity } from './user.entity';

@Entity('transactions')
@Index(['userId', 'occurredAt'])
@Index(['householdId', 'occurredAt'])
@Index(['userId', 'merchantKey'])
@Index(['userId', 'categoryId', 'occurredAt'])
export class TransactionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  /** Denormalised from the user at write time so household queries stay cheap. */
  @Column({ type: 'uuid', nullable: true })
  householdId: string | null;

  @Column({ type: 'varchar', length: 16 })
  source: TransactionSource;

  @Column({ type: 'varchar', length: 200 })
  merchant: string;

  @Column({ type: 'varchar', length: 200 })
  merchantKey: string;

  /** Integer paise. See shared/constants/money.ts. */
  @Column({ type: 'integer' })
  amountPaise: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: 'INR';

  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => CategoryEntity, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: CategoryEntity;

  @Column({ type: 'varchar', length: 8 })
  categoryConfidence: CategoryConfidence;

  @Column({ type: 'boolean', default: false })
  categoryConfirmed: boolean;

  /** Why the categoriser chose what it chose. Debug + future training label. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  categoryReason: string | null;

  @Column({ type: 'varchar', length: 16, default: PaymentMethod.UNKNOWN })
  paymentMethod: PaymentMethod;

  @Column({ type: DB.json, default: '[]' })
  items: TransactionItem[];

  @Column({ type: 'boolean', default: false })
  isShared: boolean;

  @Column({ type: DB.json, default: '[]' })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /**
   * Opaque pointer into the source system: TBEF billId, Gmail message id,
   * Android SMS id. Never the content itself — bodies are parsed and dropped.
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  rawSourceRef: string | null;

  /**
   * Natural-key for de-duplication, e.g. `nfc:pinelabs:PL-88213:RF-000123`
   * or `gmail:<messageId>`. Unique when present. Manual entries leave it null.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 300, nullable: true })
  dedupeKey: string | null;

  /** Client-supplied idempotency key for retried NFC posts. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120, nullable: true })
  idempotencyKey: string | null;

  /** True when the TBEF HMAC validated against an enrolled terminal. */
  @Column({ type: 'boolean', default: false })
  signatureVerified: boolean;

  /** Terminal metadata kept for partner reporting; null for non-NFC sources. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  terminalNetwork: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  terminalId: string | null;

  @Column({ type: DB.timestamp })
  occurredAt: Date;
}
