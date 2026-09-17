import { Body, Controller, Delete, Get, HttpCode, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BudgetPeriod, BudgetScope } from '@tapntally/shared';
import { IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { BudgetsService } from './budgets.service';

class UpsertBudgetDto {
  @IsEnum(BudgetScope)
  scope: BudgetScope;

  @IsUUID()
  categoryId: string;

  @IsInt() @Min(100) @Max(2_000_000_000)
  limitPaise: number;

  @IsOptional() @IsEnum(BudgetPeriod)
  period?: BudgetPeriod;

  @IsOptional() @IsNumber() @Min(0.1) @Max(1)
  alertThreshold?: number;
}

@ApiTags('budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.budgets.listProgress(me);
  }

  @Put()
  async upsert(@CurrentUser() me: AuthUser, @Body() dto: UpsertBudgetDto) {
    const b = await this.budgets.upsert(me, dto);
    return this.budgets.progressFor(b);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.budgets.remove(me, id);
  }
}
