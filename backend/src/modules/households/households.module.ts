import { Module } from '@nestjs/common';
import { HouseholdsController } from './households.controller';
import { HouseholdsService } from './households.service';

@Module({
  providers: [HouseholdsService],
  controllers: [HouseholdsController],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
