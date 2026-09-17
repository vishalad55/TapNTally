import { Body, Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PushService } from '../notifications/push.service';
import { UsersService } from './users.service';

class UpdateMeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @IsOptional() @IsBoolean()
  aggregateInsightsConsent?: boolean;

  @IsOptional() @IsBoolean()
  onboardingCompleted?: boolean;
}

class RegisterDeviceDto {
  @IsString() @MinLength(10)
  fcmToken: string;

  @IsIn(['android', 'ios'])
  platform: 'android' | 'ios';
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly push: PushService,
  ) {}

  @Get('me')
  async me(@CurrentUser() me: AuthUser) {
    return this.users.toDto(await this.users.getOrThrow(me.id));
  }

  @Patch('me')
  async updateMe(@CurrentUser() me: AuthUser, @Body() dto: UpdateMeDto) {
    return this.users.toDto(await this.users.update(me.id, dto));
  }

  @Post('me/devices')
  @HttpCode(204)
  async registerDevice(@CurrentUser() me: AuthUser, @Body() dto: RegisterDeviceDto) {
    await this.push.registerDevice(me.id, dto.fcmToken, dto.platform);
  }

  @Delete('me/devices')
  @HttpCode(204)
  async unregisterDevice(@Body() dto: RegisterDeviceDto) {
    await this.push.unregisterDevice(dto.fcmToken);
  }
}
