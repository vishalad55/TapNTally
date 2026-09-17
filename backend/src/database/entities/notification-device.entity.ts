import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('notification_devices')
export class NotificationDeviceEntity extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 300 })
  fcmToken: string;

  @Column({ type: 'varchar', length: 10 })
  platform: 'android' | 'ios';
}
