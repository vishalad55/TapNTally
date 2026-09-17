import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial Postgres schema. Hand-authored to mirror the entities in
 * `../entities`. Before the first production deploy, run
 * `npm run db:migrate:generate` against a scratch Postgres and diff it against
 * this file — TypeORM's generator is the authority on index naming.
 */
export class InitialSchema1758000000000 implements MigrationInterface {
  name = 'InitialSchema1758000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "households" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "name" varchar(120) NOT NULL,
        "inviteCode" varchar(16) NOT NULL
      );
      CREATE UNIQUE INDEX "IDX_households_inviteCode" ON "households" ("inviteCode");

      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "email" varchar(320) NOT NULL,
        "name" varchar(200) NOT NULL,
        "avatarUrl" varchar(1000),
        "googleSub" varchar(64),
        "householdId" uuid REFERENCES "households"("id") ON DELETE SET NULL,
        "householdRole" varchar(16),
        "householdJoinedAt" timestamptz,
        "aggregateInsightsConsent" boolean NOT NULL DEFAULT false,
        "lastSeenAt" timestamptz
      );
      CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email");
      CREATE UNIQUE INDEX "IDX_users_googleSub" ON "users" ("googleSub");
      CREATE INDEX "IDX_users_householdId" ON "users" ("householdId");

      CREATE TABLE "categories" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "slug" varchar(40),
        "name" varchar(60) NOT NULL,
        "icon" varchar(16) NOT NULL,
        "color" varchar(9) NOT NULL,
        "isCustom" boolean NOT NULL DEFAULT false,
        "userId" uuid,
        "sortOrder" integer NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX "IDX_categories_slug" ON "categories" ("slug");
      CREATE INDEX "IDX_categories_userId_name" ON "categories" ("userId", "name");

      CREATE TABLE "transactions" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "householdId" uuid,
        "source" varchar(16) NOT NULL,
        "merchant" varchar(200) NOT NULL,
        "merchantKey" varchar(200) NOT NULL,
        "amountPaise" integer NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'INR',
        "categoryId" uuid NOT NULL REFERENCES "categories"("id") ON DELETE RESTRICT,
        "categoryConfidence" varchar(8) NOT NULL,
        "categoryConfirmed" boolean NOT NULL DEFAULT false,
        "categoryReason" varchar(120),
        "paymentMethod" varchar(16) NOT NULL DEFAULT 'unknown',
        "items" text NOT NULL DEFAULT '[]',
        "isShared" boolean NOT NULL DEFAULT false,
        "tags" text NOT NULL DEFAULT '[]',
        "notes" text,
        "rawSourceRef" varchar(200),
        "dedupeKey" varchar(300),
        "idempotencyKey" varchar(120),
        "signatureVerified" boolean NOT NULL DEFAULT false,
        "terminalNetwork" varchar(40),
        "terminalId" varchar(80),
        "occurredAt" timestamptz NOT NULL
      );
      CREATE INDEX "IDX_tx_user_occurred" ON "transactions" ("userId", "occurredAt");
      CREATE INDEX "IDX_tx_household_occurred" ON "transactions" ("householdId", "occurredAt");
      CREATE INDEX "IDX_tx_user_merchant" ON "transactions" ("userId", "merchantKey");
      CREATE INDEX "IDX_tx_user_cat_occurred" ON "transactions" ("userId", "categoryId", "occurredAt");
      CREATE UNIQUE INDEX "IDX_tx_dedupeKey" ON "transactions" ("dedupeKey");
      CREATE UNIQUE INDEX "IDX_tx_idempotencyKey" ON "transactions" ("idempotencyKey");

      CREATE TABLE "budgets" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "scope" varchar(16) NOT NULL,
        "ownerId" uuid NOT NULL,
        "categoryId" uuid NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
        "limitPaise" integer NOT NULL,
        "period" varchar(8) NOT NULL DEFAULT 'monthly',
        "alertThreshold" double precision NOT NULL DEFAULT 0.8,
        "lastAlertedPeriod" varchar(12)
      );
      CREATE UNIQUE INDEX "IDX_budgets_scope_owner_cat_period" ON "budgets" ("scope", "ownerId", "categoryId", "period");

      CREATE TABLE "connections" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "type" varchar(8) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'disconnected',
        "encryptedTokens" text,
        "gmailHistoryId" varchar(40),
        "gmailWatchExpiresAt" timestamptz,
        "lastSyncedAt" timestamptz,
        "importedCount" integer NOT NULL DEFAULT 0,
        "consecutiveFailures" integer NOT NULL DEFAULT 0,
        "lastError" varchar(500)
      );
      CREATE UNIQUE INDEX "IDX_connections_user_type" ON "connections" ("userId", "type");

      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "revokedAt" timestamptz,
        "replacedById" uuid
      );
      CREATE INDEX "IDX_refresh_tokens_userId" ON "refresh_tokens" ("userId");
      CREATE UNIQUE INDEX "IDX_refresh_tokens_tokenHash" ON "refresh_tokens" ("tokenHash");

      CREATE TABLE "pos_terminals" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "network" varchar(40) NOT NULL,
        "terminalId" varchar(80) NOT NULL,
        "merchantName" varchar(200) NOT NULL,
        "merchantGstin" varchar(20),
        "encryptedSecret" text NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "billsReceived" integer NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX "IDX_pos_terminals_network_terminalId" ON "pos_terminals" ("network", "terminalId");

      CREATE TABLE "pos_partners" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "network" varchar(40) NOT NULL,
        "displayName" varchar(120) NOT NULL,
        "apiKeyHash" varchar(64) NOT NULL,
        "active" boolean NOT NULL DEFAULT true
      );
      CREATE UNIQUE INDEX "IDX_pos_partners_network" ON "pos_partners" ("network");
      CREATE UNIQUE INDEX "IDX_pos_partners_apiKeyHash" ON "pos_partners" ("apiKeyHash");

      CREATE TABLE "pairing_codes" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "code" varchar(12) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz
      );
      CREATE UNIQUE INDEX "IDX_pairing_codes_code" ON "pairing_codes" ("code");

      CREATE TABLE "notification_devices" (
        "id" uuid PRIMARY KEY,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "fcmToken" varchar(300) NOT NULL,
        "platform" varchar(10) NOT NULL
      );
      CREATE INDEX "IDX_notification_devices_userId" ON "notification_devices" ("userId");
      CREATE UNIQUE INDEX "IDX_notification_devices_fcmToken" ON "notification_devices" ("fcmToken");
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE IF EXISTS "notification_devices";
      DROP TABLE IF EXISTS "pairing_codes";
      DROP TABLE IF EXISTS "pos_partners";
      DROP TABLE IF EXISTS "pos_terminals";
      DROP TABLE IF EXISTS "refresh_tokens";
      DROP TABLE IF EXISTS "connections";
      DROP TABLE IF EXISTS "budgets";
      DROP TABLE IF EXISTS "transactions";
      DROP TABLE IF EXISTS "categories";
      DROP TABLE IF EXISTS "users";
      DROP TABLE IF EXISTS "households";
    `);
  }
}
