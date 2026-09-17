import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { InternalKeyGuard } from '../../common/auth/internal-key.guard';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { TransactionsService } from '../transactions/transactions.service';
import { PosService } from './pos.service';

class EnrollTerminalDto {
  @IsString() @Matches(/^[a-z0-9_-]{2,40}$/)
  network: string;

  @IsString() @MinLength(2) @MaxLength(80)
  terminalId: string;

  @IsString() @MinLength(1) @MaxLength(200)
  merchantName: string;

  @IsOptional() @IsString() @MaxLength(20)
  merchantGstin?: string;

  /** Optional fixed secret (demo/test only). Omit to have one generated. */
  @IsOptional() @IsString() @MinLength(16) @MaxLength(128)
  secret?: string;
}

class CreatePartnerDto {
  @IsString() @Matches(/^[a-z0-9_-]{2,40}$/)
  network: string;

  @IsString() @MinLength(1) @MaxLength(120)
  displayName: string;
}

class SetActiveDto {
  @IsBoolean()
  active: boolean;
}

class PartnerPushBillDto {
  @IsString() @MinLength(6) @MaxLength(6)
  pairingCode: string;

  @IsObject()
  bill: unknown;
}

/** Operator endpoints — X-Internal-Key. */
@ApiTags('internal:pos')
@ApiSecurity('internal-key')
@UseGuards(InternalKeyGuard)
@Controller('internal/pos')
export class PosInternalController {
  constructor(private readonly pos: PosService) {}

  @Post('terminals')
  enroll(@Body() dto: EnrollTerminalDto) {
    return this.pos.enrollTerminal(dto);
  }

  @Get('terminals')
  list() {
    return this.pos.listTerminals();
  }

  @Patch('terminals/:id')
  @HttpCode(204)
  async setActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    await this.pos.setTerminalActive(id, dto.active);
  }

  @Post('partners')
  createPartner(@Body() dto: CreatePartnerDto) {
    return this.pos.createPartner(dto);
  }
}

/** User endpoint — JWT. */
@ApiTags('pos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pos')
export class PosUserController {
  constructor(private readonly pos: PosService) {}

  @Post('pairing-code')
  pairingCode(@CurrentUser() me: AuthUser) {
    return this.pos.createPairingCode(me);
  }
}

/** Partner endpoint — X-Partner-Key. */
@ApiTags('partner')
@ApiSecurity('partner-key')
@Controller('partner')
export class PosPartnerController {
  constructor(
    private readonly pos: PosService,
    private readonly transactions: TransactionsService,
  ) {}

  @Post('bills')
  @HttpCode(200)
  async pushBill(@Headers('x-partner-key') apiKey: string | undefined, @Body() dto: PartnerPushBillDto) {
    const partner = await this.pos.authenticatePartner(apiKey);
    const { transaction, created } = await this.pos.pushBill(partner, dto.pairingCode, dto.bill);
    return { transactionId: transaction.id, created, categorisedAs: transaction.category.name };
  }
}
