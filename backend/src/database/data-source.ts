import 'reflect-metadata';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AppConfig, loadConfig } from '../config/configuration';
import { ALL_ENTITIES } from './entities';

/**
 * Builds TypeORM options for either driver.
 *
 *  - sqljs:    single-file DB, zero native deps, schema auto-synced. Dev + demo.
 *  - postgres: production. Schema managed by migrations only.
 */
export function buildDataSourceOptions(cfg: AppConfig): DataSourceOptions {
  const common: Pick<DataSourceOptions, 'entities' | 'migrations' | 'logging'> = {
    entities: ALL_ENTITIES,
    migrations: [resolve(__dirname, 'migrations/*.{ts,js}')],
    logging: cfg.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  };

  if (cfg.DB_DRIVER === 'postgres') {
    if (!cfg.DATABASE_URL) throw new Error('DATABASE_URL is required when DB_DRIVER=postgres');
    return {
      ...common,
      type: 'postgres',
      url: cfg.DATABASE_URL,
      synchronize: cfg.DB_SYNCHRONIZE,
      migrationsRun: !cfg.DB_SYNCHRONIZE,
      ssl: cfg.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      extra: { max: 10 },
    };
  }

  const file = resolve(process.cwd(), cfg.DB_SQLJS_FILE);
  mkdirSync(dirname(file), { recursive: true });
  return {
    ...common,
    type: 'sqljs',
    location: file,
    autoSave: true,
    synchronize: cfg.DB_SYNCHRONIZE || cfg.NODE_ENV !== 'production',
  };
}

// ---- TypeORM CLI entrypoint (npm run typeorm -- migration:run) ----
// Same precedence as AppModule: `.env` wins, `.env.example` supplies dev defaults.
loadDotenv({ path: ['.env', '.env.example'] });
export default new DataSource(buildDataSourceOptions(loadConfig()));
