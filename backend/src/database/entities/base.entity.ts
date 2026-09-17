import { randomUUID } from 'node:crypto';
import { BeforeInsert, CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { DB } from '../db-types';

/**
 * UUIDs are generated app-side so we don't depend on `uuid-ossp` /
 * `gen_random_uuid()` privileges in Postgres and get identical behaviour on
 * sql.js.
 */
export abstract class BaseEntity {
  @PrimaryColumn('uuid')
  id: string;

  @CreateDateColumn({ type: DB.timestamp })
  createdAt: Date;

  @UpdateDateColumn({ type: DB.timestamp })
  updatedAt: Date;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = randomUUID();
  }
}
