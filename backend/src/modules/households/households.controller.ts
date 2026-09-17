import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { HouseholdsService } from './households.service';

class CreateHouseholdDto {
  @IsString() @MinLength(1) @MaxLength(120)
  name: string;
}
class JoinHouseholdDto {
  @IsString() @MinLength(5) @MaxLength(12)
  inviteCode: string;
}

@ApiTags('households')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households')
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get('me')
  async me(@CurrentUser() me: AuthUser) {
    const h = await this.households.getMine(me);
    return h ? this.households.toDto(h) : null;
  }

  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreateHouseholdDto) {
    return this.households.toDto(await this.households.create(me, dto.name));
  }

  @Post('join')
  async join(@CurrentUser() me: AuthUser, @Body() dto: JoinHouseholdDto) {
    return this.households.toDto(await this.households.join(me, dto.inviteCode));
  }

  @Post('leave')
  @HttpCode(204)
  async leave(@CurrentUser() me: AuthUser) {
    await this.households.leave(me);
  }

  @Post('invite/rotate')
  async rotate(@CurrentUser() me: AuthUser) {
    return this.households.toDto(await this.households.rotateInvite(me));
  }

  @Patch('me')
  async rename(@CurrentUser() me: AuthUser, @Body() dto: CreateHouseholdDto) {
    return this.households.toDto(await this.households.rename(me, dto.name));
  }
}
