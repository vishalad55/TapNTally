import { Body, Controller, ForbiddenException, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AppConfigService } from '../../config/app-config.service';
import { TransactionsService } from '../transactions/transactions.service';
import { NfcService } from './nfc.service';

class NfcIngestDto {
  @IsObject()
  bill: unknown;

  @IsString() @MinLength(8) @MaxLength(120)
  idempotencyKey: string;
}

@ApiTags('nfc')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nfc')
export class NfcController {
  constructor(
    private readonly nfc: NfcService,
    private readonly transactions: TransactionsService,
    private readonly config: AppConfigService,
  ) {}

  /** The endpoint the phone hits immediately after a successful tap. */
  @Post('bills')
  @HttpCode(200)
  async ingest(@CurrentUser() me: AuthUser, @Body() dto: NfcIngestDto) {
    const { transaction, created, signatureVerified } = await this.nfc.ingestBill(me, dto.bill, dto.idempotencyKey);
    return { transaction: this.transactions.toDto(transaction), created, signatureVerified };
  }

  /** Dev-only: fetch a signed demo bill to simulate a tap. */
  @Get('demo-bill')
  demoBill() {
    if (!this.config.get('AUTH_DEV_LOGIN')) throw new ForbiddenException('Demo bills are disabled');
    return this.nfc.demoBill();
  }
}
