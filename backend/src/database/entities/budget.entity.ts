import { BudgetPeriod, BudgetScope } from '@tapntally/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DB } from '../db-types';
import { BaseEntity } from './base.entity';
import { CategoryEntity } from './category.entity';

@Entity('budgets')
@Index(['scope', 'ownerId', 'categoryId', 'period'], { unique: true })
export class BudgetEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 16 })
  scope: BudgetScope;

  /** userId for USER scope; householdId for HOUSEHOLD scope. */
  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => CategoryEntity, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: CategoryEntity;

  @Column({ type: 'integer' })
  limitPaise: number;

  @Column({ type: 'varchar', length: 8, default: BudgetPeriod.MONTHLY })
  period: BudgetPeriod;

  @Column({ type: DB.real, default: 0.8 })
  alertThreshold: number;

  /** periodKey (e.g. "2026-09") of the last threshold alert, to send it once per period. */
  @Column({ type: 'varchar', length: 12, nullable: true })
  lastAlertedPeriod: string | null;
}
