import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { InsightsService } from './insights.service';

class RecapQueryDto {
  @IsOptional() @IsIn(['weekly', 'monthly'])
  period?: 'weekly' | 'monthly';

  @IsOptional() @IsIn(['personal', 'shared'])
  scope?: 'personal' | 'shared';
}

@ApiTags('insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('recap')
  recap(@CurrentUser() me: AuthUser, @Query() q: RecapQueryDto) {
    return this.insights.recap(me, q.period ?? 'monthly', q.scope ?? 'personal');
  }
}
