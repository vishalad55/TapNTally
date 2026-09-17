import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './configuration';

/** Typed accessor so modules never touch string keys. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config.getOrThrow<AppConfig>('app')[key];
  }

  get isProd(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
}
