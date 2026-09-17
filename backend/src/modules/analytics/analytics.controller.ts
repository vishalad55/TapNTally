import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Min } from 'class-validator';
import { InternalKeyGuard } from '../../common/auth/internal-key.guard';
import { AnalyticsService } from './analytics.service';

class TrendQueryDto {
  @IsOptional() @IsISO8601()
  from?: string;

  @IsOptional() @IsISO8601()
  to?: string;

  /** Dev/demo only; ignored in production. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  minCohort?: number;
}

@ApiTags('internal:analytics')
@ApiSecurity('internal-key')
@UseGuards(InternalKeyGuard)
@Controller('internal/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('consent')
  consent() {
    return this.analytics.consentSummary();
  }

  @Get('category-trends')
  categoryTrends(@Query() q: TrendQueryDto) {
    const { from, to } = window(q);
    return this.analytics.categoryTrends(from, to, q.minCohort);
  }

  @Get('merchant-trends')
  merchantTrends(@Query() q: TrendQueryDto) {
    const { from, to } = window(q);
    return this.analytics.merchantTrends(from, to, q.minCohort);
  }
}

function window(q: TrendQueryDto): { from: Date; to: Date } {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 90 * 24 * 3600 * 1000);
  return { from, to };
}
