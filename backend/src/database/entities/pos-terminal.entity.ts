import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * An enrolled POS terminal. This is the anchor of the partner-integration
 * layer: bills signed with the terminal's secret are marked verified, and
 * partners with an API key can push bills server-to-server instead of NFC.
 */
@Entity('pos_terminals')
@Index(['network', 'terminalId'], { unique: true })
export class PosTerminalEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 40 })
  network: string;

  @Column({ type: 'varchar', length: 80 })
  terminalId: string;

  @Column({ type: 'varchar', length: 200 })
  merchantName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  merchantGstin: string | null;

  /** AES-GCM encrypted HMAC secret shared with the terminal firmware/SDK. */
  @Column({ type: 'text' })
  encryptedSecret: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  billsReceived: number;
}
