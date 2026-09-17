import { z } from 'zod';

/**
 * Environment schema. Validated once at boot; the app refuses to start on a
 * bad config rather than failing later in a request. Keep this the single
 * source of truth for env vars — never read `process.env` elsewhere.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().default(''),

  DB_DRIVER: z.enum(['sqljs', 'postgres']).default('sqljs'),
  DB_SQLJS_FILE: z.string().default('./data/tapntally.sqlite'),
  DATABASE_URL: z.string().optional(),
  DB_SYNCHRONIZE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  AUTH_DEV_LOGIN: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'ENCRYPTION_KEY must decode to 32 bytes'),

  NFC_REQUIRE_SIGNATURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  REDIS_URL: z.string().optional().default(''),

  GMAIL_PUBSUB_TOPIC: z.string().optional().default(''),
  GMAIL_WEBHOOK_TOKEN: z.string().optional().default(''),
  GMAIL_BACKFILL_DAYS: z.coerce.number().int().positive().default(180),

  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional().default(''),

  INTERNAL_API_KEY: z.string().min(8),

  /**
   * Hosted-demo switch: relaxes the production guards below so a public pitch
   * demo can run dev login + an in-memory database on serverless hosting.
   * Never enable for real users.
   */
  DEMO_MODE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  /** Seed the demo dataset on boot when the demo user is missing (used with :memory: DBs). */
  DEMO_AUTOSEED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV === 'production' && !cfg.DEMO_MODE) {
    if (cfg.AUTH_DEV_LOGIN) throw new Error('AUTH_DEV_LOGIN must be false in production');
    if (cfg.DB_SYNCHRONIZE) throw new Error('DB_SYNCHRONIZE must be false in production');
    if (cfg.DB_DRIVER !== 'postgres') throw new Error('DB_DRIVER must be postgres in production');
  }
  return cfg;
}

/** Nest ConfigModule factory. */
export const configuration = () => ({ app: loadConfig() });
