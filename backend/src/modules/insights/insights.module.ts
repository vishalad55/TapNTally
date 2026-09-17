import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

@Module({
  providers: [InsightsService],
  controllers: [InsightsController],
})
export class InsightsModule {}
