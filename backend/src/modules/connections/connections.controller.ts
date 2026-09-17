import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsISO8601, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ConnectionsService } from './connections.service';

class ConnectGmailDto {
  @IsString() @MinLength(10)
  authCode: string;
}

class SmsMessageDto {
  @IsString() @MinLength(1) @MaxLength(64)
  id: string;

  @IsString() @MaxLength(40)
  sender: string;

  @IsString() @MaxLength(1000)
  body: string;

  @IsISO8601()
  receivedAt: string;
}

class SmsIngestDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => SmsMessageDto)
  messages: SmsMessageDto[];
}

@ApiTags('connections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.connections.list(me);
  }

  @Post('gmail')
  connectGmail(@CurrentUser() me: AuthUser, @Body() dto: ConnectGmailDto) {
    return this.connections.connectGmail(me, dto.authCode);
  }

  @Post('gmail/sync')
  syncGmail(@CurrentUser() me: AuthUser) {
    return this.connections.triggerGmailSync(me);
  }

  @Delete('gmail')
  @HttpCode(204)
  async disconnectGmail(@CurrentUser() me: AuthUser) {
    await this.connections.disconnectGmail(me);
  }

  @Post('sms')
  enableSms(@CurrentUser() me: AuthUser) {
    return this.connections.enableSms(me);
  }

  @Delete('sms')
  @HttpCode(204)
  async disableSms(@CurrentUser() me: AuthUser) {
    await this.connections.disableSms(me);
  }

  @Post('sms/ingest')
  ingestSms(@CurrentUser() me: AuthUser, @Body() dto: SmsIngestDto) {
    return this.connections.ingestSms(me, dto.messages);
  }
}
