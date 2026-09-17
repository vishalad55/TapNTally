import { Module } from '@nestjs/common';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

@Module({
  providers: [BudgetsService],
  controllers: [BudgetsController],
  exports: [BudgetsService],
})
export class BudgetsModule {}
