import { CategorySlug } from '@tapntally/shared';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('categories')
@Index(['userId', 'name'])
export class CategoryEntity extends BaseEntity {
  /** Canonical slug; null for user-defined custom categories. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40, nullable: true })
  slug: CategorySlug | null;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  icon: string;

  @Column({ type: 'varchar', length: 9 })
  color: string;

  @Column({ type: 'boolean', default: false })
  isCustom: boolean;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;
}
