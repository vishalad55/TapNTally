import { Module } from '@nestjs/common';
import { PosInternalController, PosPartnerController, PosUserController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  providers: [PosService],
  controllers: [PosInternalController, PosUserController, PosPartnerController],
  exports: [PosService],
})
export class PosModule {}
