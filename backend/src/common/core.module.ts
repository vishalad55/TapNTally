import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { EncryptionService } from './crypto/encryption.service';

/**
 * Cross-cutting singletons every feature module needs. Global so feature
 * modules don't each have to import it.
 */
@Global()
@Module({
  providers: [AppConfigService, EncryptionService],
  exports: [AppConfigService, EncryptionService],
})
export class CoreModule {}
