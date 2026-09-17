import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@tapntally/shared';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  async getOrThrow(id: string): Promise<UserEntity> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, patch: { name?: string; aggregateInsightsConsent?: boolean }): Promise<UserEntity> {
    const user = await this.getOrThrow(id);
    if (patch.name !== undefined) user.name = patch.name.trim();
    if (patch.aggregateInsightsConsent !== undefined) user.aggregateInsightsConsent = patch.aggregateInsightsConsent;
    return this.users.save(user);
  }

  toDto(u: UserEntity): User {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      householdId: u.householdId,
      householdRole: u.householdRole,
      aggregateInsightsConsent: u.aggregateInsightsConsent,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
