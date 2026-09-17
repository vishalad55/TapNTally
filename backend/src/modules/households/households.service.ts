import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Household, HouseholdRole } from '@tapntally/shared';
import { customAlphabet } from 'nanoid';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../../common/auth/current-user.decorator';
import { AppError } from '../../common/filters/http-exception.filter';
import { BudgetEntity, HouseholdEntity, UserEntity } from '../../database/entities';
import { TransactionsService } from '../transactions/transactions.service';

// No 0/O/1/I so the code survives being read out loud or typed from a screenshot.
const codeGen = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

@Injectable()
export class HouseholdsService {
  constructor(
    @InjectRepository(HouseholdEntity) private readonly households: Repository<HouseholdEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(BudgetEntity) private readonly budgets: Repository<BudgetEntity>,
    private readonly transactions: TransactionsService,
    private readonly db: DataSource,
  ) {}

  async getMine(me: AuthUser): Promise<HouseholdEntity | null> {
    if (!me.householdId) return null;
    return this.households.findOne({ where: { id: me.householdId }, relations: { members: true } });
  }

  async create(me: AuthUser, name: string): Promise<HouseholdEntity> {
    if (me.householdId) throw new AppError('ALREADY_IN_HOUSEHOLD', 'Leave your current household first', HttpStatus.CONFLICT);
    const household = await this.households.save(
      this.households.create({ name: name.trim(), inviteCode: await this.uniqueCode() }),
    );
    await this.attach(me.id, household.id, HouseholdRole.OWNER);
    return this.households.findOneOrFail({ where: { id: household.id }, relations: { members: true } });
  }

  async join(me: AuthUser, inviteCode: string): Promise<HouseholdEntity> {
    if (me.householdId) throw new AppError('ALREADY_IN_HOUSEHOLD', 'Leave your current household first', HttpStatus.CONFLICT);
    const normalized = inviteCode.trim().toUpperCase().replace(/^TAP-?/, '');
    const household = await this.households.findOne({ where: { inviteCode: normalized } });
    if (!household) throw new AppError('INVALID_INVITE', 'That invite code is not valid', HttpStatus.NOT_FOUND);
    await this.attach(me.id, household.id, HouseholdRole.MEMBER);
    return this.households.findOneOrFail({ where: { id: household.id }, relations: { members: true } });
  }

  async leave(me: AuthUser): Promise<void> {
    if (!me.householdId) return;
    const hid = me.householdId;
    await this.db.transaction(async (em) => {
      const users = em.getRepository(UserEntity);
      const others = await users.find({ where: { householdId: hid }, order: { householdJoinedAt: 'ASC' } });
      const remaining = others.filter((u) => u.id !== me.id);

      await users.update({ id: me.id }, { householdId: null, householdRole: null, householdJoinedAt: null });
      await this.transactions.reassignHousehold(me.id, null);

      if (remaining.length === 0) {
        await em.getRepository(BudgetEntity).delete({ ownerId: hid });
        await em.getRepository(HouseholdEntity).delete({ id: hid });
      } else if (!remaining.some((u) => u.householdRole === HouseholdRole.OWNER)) {
        await users.update({ id: remaining[0].id }, { householdRole: HouseholdRole.OWNER });
      }
    });
  }

  async rotateInvite(me: AuthUser): Promise<HouseholdEntity> {
    const h = await this.requireOwner(me);
    h.inviteCode = await this.uniqueCode();
    await this.households.save(h);
    return this.households.findOneOrFail({ where: { id: h.id }, relations: { members: true } });
  }

  async rename(me: AuthUser, name: string): Promise<HouseholdEntity> {
    const h = await this.requireOwner(me);
    h.name = name.trim();
    await this.households.save(h);
    return this.households.findOneOrFail({ where: { id: h.id }, relations: { members: true } });
  }

  private async requireOwner(me: AuthUser): Promise<HouseholdEntity> {
    const user = await this.users.findOneOrFail({ where: { id: me.id } });
    if (!user.householdId || user.householdRole !== HouseholdRole.OWNER) {
      throw new AppError('NOT_HOUSEHOLD_OWNER', 'Only the household owner can do that', HttpStatus.FORBIDDEN);
    }
    return this.households.findOneOrFail({ where: { id: user.householdId } });
  }

  private async attach(userId: string, householdId: string, role: HouseholdRole) {
    await this.users.update({ id: userId }, { householdId, householdRole: role, householdJoinedAt: new Date() });
    await this.transactions.reassignHousehold(userId, householdId);
  }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = codeGen();
      if (!(await this.households.findOne({ where: { inviteCode: code } }))) return code;
    }
    throw new Error('Could not generate a unique invite code');
  }

  toDto(h: HouseholdEntity): Household {
    return {
      id: h.id,
      name: h.name,
      inviteCode: `TAP-${h.inviteCode}`,
      createdAt: h.createdAt.toISOString(),
      members: (h.members ?? [])
        .slice()
        .sort((a, b) => (a.householdJoinedAt?.getTime() ?? 0) - (b.householdJoinedAt?.getTime() ?? 0))
        .map((m) => ({
          userId: m.id,
          name: m.name,
          avatarUrl: m.avatarUrl,
          role: m.householdRole ?? HouseholdRole.MEMBER,
          joinedAt: (m.householdJoinedAt ?? m.createdAt).toISOString(),
        })),
    };
  }
}
