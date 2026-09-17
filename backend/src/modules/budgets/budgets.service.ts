import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Budget, BudgetPeriod, BudgetProgress, BudgetScope, formatPaise } from '@tapntally/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/auth/current-user.decorator';
import { AppError } from '../../common/filters/http-exception.filter';
import { periodKey, rangeFor } from '../../common/utils/period';
import { BudgetEntity, UserEntity } from '../../database/entities';
import { CategoriesService } from '../categories/categories.service';
import { PushService } from '../notifications/push.service';
import { BudgetCheckJob, JOBS, QueueService } from '../queue/queue.service';
import { TransactionsService } from '../transactions/transactions.service';

export interface UpsertBudgetInput {
  scope: BudgetScope;
  categoryId: string;
  limitPaise: number;
  period?: BudgetPeriod;
  alertThreshold?: number;
}

@Injectable()
export class BudgetsService implements OnModuleInit {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    @InjectRepository(BudgetEntity) private readonly budgets: Repository<BudgetEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly categories: CategoriesService,
    private readonly transactions: TransactionsService,
    private readonly push: PushService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    this.queue.register<BudgetCheckJob>(JOBS.BUDGET_CHECK, (job) => this.checkAndAlert(job));
  }

  private ownerFor(me: AuthUser, scope: BudgetScope): string {
    if (scope === BudgetScope.USER) return me.id;
    if (!me.householdId) throw new AppError('NO_HOUSEHOLD', 'Join or create a household to set a shared budget', HttpStatus.BAD_REQUEST);
    return me.householdId;
  }

  async upsert(me: AuthUser, input: UpsertBudgetInput): Promise<BudgetEntity> {
    const ownerId = this.ownerFor(me, input.scope);
    const category = await this.categories.resolveForUser(me.id, input.categoryId);
    const period = input.period ?? BudgetPeriod.MONTHLY;

    let budget = await this.budgets.findOne({ where: { scope: input.scope, ownerId, categoryId: category.id, period } });
    if (!budget) {
      budget = this.budgets.create({ scope: input.scope, ownerId, categoryId: category.id, period, lastAlertedPeriod: null });
    }
    budget.limitPaise = input.limitPaise;
    budget.alertThreshold = input.alertThreshold ?? budget.alertThreshold ?? 0.8;
    // A raised limit may drop us back under the threshold; allow a fresh alert later.
    budget.lastAlertedPeriod = null;
    const saved = await this.budgets.save(budget);
    return this.budgets.findOneOrFail({ where: { id: saved.id } });
  }

  async remove(me: AuthUser, id: string): Promise<void> {
    const b = await this.budgets.findOne({ where: { id } });
    if (!b) throw new AppError('BUDGET_NOT_FOUND', 'Budget not found', HttpStatus.NOT_FOUND);
    const allowed = (b.scope === BudgetScope.USER && b.ownerId === me.id) || (b.scope === BudgetScope.HOUSEHOLD && b.ownerId === me.householdId);
    if (!allowed) throw new AppError('BUDGET_NOT_FOUND', 'Budget not found', HttpStatus.NOT_FOUND);
    await this.budgets.remove(b);
  }

  async listProgress(me: AuthUser): Promise<BudgetProgress[]> {
    const where = [{ scope: BudgetScope.USER, ownerId: me.id }];
    if (me.householdId) where.push({ scope: BudgetScope.HOUSEHOLD, ownerId: me.householdId });
    const budgets = await this.budgets.find({ where, order: { scope: 'ASC', createdAt: 'ASC' } });
    return Promise.all(budgets.map((b) => this.progressFor(b)));
  }

  async progressFor(b: BudgetEntity, now = new Date()): Promise<BudgetProgress> {
    const range = rangeFor(b.period, now);
    const spent = await this.transactions.spentInCategory(
      b.scope === BudgetScope.USER ? { userId: b.ownerId } : { householdId: b.ownerId },
      b.categoryId,
      range,
    );
    const ratio = b.limitPaise > 0 ? spent / b.limitPaise : 0;
    return {
      budget: this.toDto(b),
      spentPaise: spent,
      ratio,
      status: ratio >= 1 ? 'exceeded' : ratio >= b.alertThreshold ? 'warning' : 'ok',
      periodStart: range.start.toISOString(),
      periodEnd: range.end.toISOString(),
    };
  }

  /** Job: after spend in a category, alert once per period when crossing the threshold. */
  async checkAndAlert(job: BudgetCheckJob): Promise<void> {
    const where = [{ scope: BudgetScope.USER, ownerId: job.userId, categoryId: job.categoryId }];
    if (job.householdId) where.push({ scope: BudgetScope.HOUSEHOLD, ownerId: job.householdId, categoryId: job.categoryId });
    const budgets = await this.budgets.find({ where });

    for (const b of budgets) {
      const key = periodKey(b.period);
      if (b.lastAlertedPeriod === key) continue;
      const progress = await this.progressFor(b);
      if (progress.status === 'ok') continue;

      const pct = Math.round(progress.ratio * 100);
      const cat = b.category.name;
      const message =
        progress.status === 'exceeded'
          ? { title: `${cat} budget crossed`, body: `You've spent ${formatPaise(progress.spentPaise, { showDecimals: false })} of your ${formatPaise(b.limitPaise, { showDecimals: false })} ${b.period} budget.` }
          : { title: `${pct}% of your ${cat} budget used`, body: `${formatPaise(b.limitPaise - progress.spentPaise, { showDecimals: false })} left for the rest of the ${b.period === BudgetPeriod.WEEKLY ? 'week' : 'month'}.` };

      const recipients =
        b.scope === BudgetScope.USER
          ? [b.ownerId]
          : (await this.users.find({ where: { householdId: b.ownerId }, select: { id: true } })).map((u) => u.id);

      await this.push.sendToUsers(recipients, { ...message, data: { screen: 'budgets', categoryId: b.categoryId, scope: b.scope } });
      b.lastAlertedPeriod = key;
      await this.budgets.save(b);
      this.logger.log(`Budget alert sent: ${b.scope}/${cat} ${pct}% → ${recipients.length} user(s)`);
    }
  }

  toDto(b: BudgetEntity): Budget {
    return {
      id: b.id,
      scope: b.scope,
      ownerId: b.ownerId,
      categoryId: b.categoryId,
      category: this.categories.toDto(b.category),
      limitPaise: b.limitPaise,
      period: b.period,
      alertThreshold: b.alertThreshold,
      createdAt: b.createdAt.toISOString(),
    };
  }
}
