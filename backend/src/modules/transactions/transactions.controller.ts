import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransactionSource } from '@tapntally/shared';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreateManualTransactionDto, SummaryQueryDto, TransactionQueryDto, UpdateTransactionDto } from './dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@CurrentUser() me: AuthUser, @Query() query: TransactionQueryDto) {
    return this.transactions.list(me, query);
  }

  @Get('summary')
  summary(@CurrentUser() me: AuthUser, @Query() query: SummaryQueryDto) {
    return this.transactions.summary(me, query);
  }

  @Get(':id')
  async get(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.transactions.toDto(await this.transactions.getOwned(me, id));
  }

  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreateManualTransactionDto) {
    const { transaction } = await this.transactions.ingest({
      userId: me.id,
      source: TransactionSource.MANUAL,
      merchant: dto.merchant,
      amountPaise: dto.amountPaise,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      paymentMethod: dto.paymentMethod,
      items: dto.items,
      categoryId: dto.categoryId,
      isShared: dto.isShared,
      tags: dto.tags,
      notes: dto.notes,
    });
    return this.transactions.toDto(transaction);
  }

  @Patch(':id')
  async update(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactions.toDto(await this.transactions.update(me, id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.transactions.remove(me, id);
  }
}
