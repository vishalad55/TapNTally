import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CoreModule } from './common/core.module';
import { configuration } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { HouseholdsModule } from './modules/households/households.module';
import { InsightsModule } from './modules/insights/insights.module';
import { NfcModule } from './modules/nfc/nfc.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PosModule } from './modules/pos/pos.module';
import { QueueModule } from './modules/queue/queue.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // `.env` wins; `.env.example` provides safe dev defaults so a fresh clone boots with zero setup.
      envFilePath: ['.env', '.env.example'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    CoreModule,
    DatabaseModule,
    QueueModule,
    NotificationsModule,
    CategoriesModule,
    UsersModule,
    AuthModule,
    TransactionsModule,
    NfcModule,
    BudgetsModule,
    HouseholdsModule,
    ConnectionsModule,
    InsightsModule,
    AnalyticsModule,
    PosModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
