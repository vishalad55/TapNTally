import { Module } from '@nestjs/common';
import { NfcController } from './nfc.controller';
import { NfcService } from './nfc.service';

@Module({
  providers: [NfcService],
  controllers: [NfcController],
  exports: [NfcService],
})
export class NfcModule {}
