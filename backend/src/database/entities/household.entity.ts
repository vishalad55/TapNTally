import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity('households')
export class HouseholdEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Short, human-typable code shared out of band, e.g. "TAP-7K3Q9". */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  inviteCode: string;

  @OneToMany(() => UserEntity, (u) => u.household)
  members: UserEntity[];
}
