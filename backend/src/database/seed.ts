/* eslint-disable no-console */
import 'reflect-metadata';
import type { INestApplicationContext, LoggerService } from '@nestjs/common';
import {
  BudgetPeriod,
  BudgetScope,
  CATEGORY_CATALOG,
  CategorySlug,
  ConnectionStatus,
  ConnectionType,
  HouseholdRole,
  PaymentMethod,
  TransactionSource,
  categorize,
  normalizeMerchant,
} from '@tapntally/shared';
import { config as loadDotenv } from 'dotenv';
import { createCipheriv, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppConfig, loadConfig } from '../config/configuration';
import { buildDataSourceOptions } from './data-source';
import {
  BudgetEntity,
  CategoryEntity,
  ConnectionEntity,
  HouseholdEntity,
  PosTerminalEntity,
  TransactionEntity,
  UserEntity,
} from './entities';

/**
 * Demo data for a convincing walkthrough. Idempotent: re-running wipes and
 * recreates only the demo users' data.
 *
 *   CLI:      npm run db:seed
 *   Runtime:  DEMO_AUTOSEED=true (hosted demo with an in-memory DB)
 *
 * Demo accounts (dev login):  demo@tapntally.app  (owner)
 *                              priya@tapntally.app (household member)
 * Demo terminal secret:        demo-terminal-secret-0001   (network=demo, id=DEMO-001)
 */
export const DEMO_TERMINAL_SECRET = 'demo-terminal-secret-0001';
export const DEMO_EMAILS = ['demo@tapntally.app', 'priya@tapntally.app'] as const;

function encryptWith(keyB64: string, plaintext: string): string {
  const key = Buffer.from(keyB64, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')}`;
}

interface MerchantProfile {
  name: string;
  min: number; // rupees
  max: number;
  freq: number; // relative frequency weight
  method: PaymentMethod[];
  source: TransactionSource[];
  items?: (between: (lo: number, hi: number) => number) => Array<{ name: string; qty: number; unit: number }>;
  mcc?: string;
}

const MERCHANTS: MerchantProfile[] = [
  { name: 'Swiggy', min: 180, max: 900, freq: 9, method: [PaymentMethod.UPI], source: [TransactionSource.SMS, TransactionSource.GMAIL] },
  { name: 'Zomato', min: 200, max: 1100, freq: 7, method: [PaymentMethod.UPI, PaymentMethod.CARD], source: [TransactionSource.SMS, TransactionSource.GMAIL] },
  { name: 'BigBasket', min: 600, max: 3200, freq: 5, method: [PaymentMethod.UPI], source: [TransactionSource.GMAIL] },
  { name: 'Reliance Fresh - Koramangala', min: 350, max: 2400, freq: 6, method: [PaymentMethod.CARD, PaymentMethod.CASH], source: [TransactionSource.NFC], mcc: '5411',
    items: (b) => [
      { name: 'Amul Taaza Milk 1L', qty: b(1, 3), unit: 68 }, { name: 'Aashirvaad Atta 5kg', qty: 1, unit: 285 },
      { name: 'Tomatoes (kg)', qty: 1, unit: 42 }, { name: 'Onions (kg)', qty: 2, unit: 35 }, { name: 'Tata Salt 1kg', qty: 1, unit: 28 },
    ].slice(0, b(2, 5)) },
  { name: 'Vidyarthi Bhavan', min: 180, max: 620, freq: 4, method: [PaymentMethod.CARD, PaymentMethod.CASH], source: [TransactionSource.NFC], mcc: '5812',
    items: (b) => [{ name: 'Masala Dosa', qty: b(1, 3), unit: 90 }, { name: 'Filter Coffee', qty: b(1, 2), unit: 35 }] },
  { name: 'Third Wave Coffee', min: 220, max: 680, freq: 5, method: [PaymentMethod.CARD, PaymentMethod.UPI], source: [TransactionSource.NFC, TransactionSource.SMS], mcc: '5814',
    items: (b) => [{ name: 'Flat White', qty: b(1, 2), unit: 240 }, { name: 'Almond Croissant', qty: 1, unit: 180 }] },
  { name: 'Amazon', min: 299, max: 4999, freq: 6, method: [PaymentMethod.UPI, PaymentMethod.CARD], source: [TransactionSource.GMAIL] },
  { name: 'Flipkart', min: 399, max: 6999, freq: 3, method: [PaymentMethod.CARD], source: [TransactionSource.GMAIL] },
  { name: 'Myntra', min: 799, max: 3499, freq: 2, method: [PaymentMethod.UPI], source: [TransactionSource.GMAIL] },
  { name: 'Uber', min: 120, max: 480, freq: 7, method: [PaymentMethod.UPI], source: [TransactionSource.SMS] },
  { name: 'Rapido', min: 45, max: 160, freq: 5, method: [PaymentMethod.UPI], source: [TransactionSource.SMS] },
  { name: 'Namma Metro', min: 30, max: 80, freq: 6, method: [PaymentMethod.UPI], source: [TransactionSource.SMS] },
  { name: 'Indian Oil - HSR Layout', min: 1500, max: 3200, freq: 2, method: [PaymentMethod.CARD], source: [TransactionSource.NFC], mcc: '5541',
    items: (b) => [{ name: 'Petrol (L)', qty: b(15, 30), unit: 103 }] },
  { name: 'Apollo Pharmacy', min: 180, max: 1400, freq: 2, method: [PaymentMethod.CARD, PaymentMethod.UPI], source: [TransactionSource.NFC, TransactionSource.SMS], mcc: '5912',
    items: () => [{ name: 'Dolo 650 (15 tabs)', qty: 1, unit: 32 }, { name: 'Cetirizine 10mg', qty: 1, unit: 28 }, { name: 'Vitamin D3 60k', qty: 4, unit: 45 }] },
  { name: 'BESCOM', min: 1200, max: 2600, freq: 1, method: [PaymentMethod.UPI], source: [TransactionSource.SMS] },
  { name: 'Airtel', min: 599, max: 999, freq: 1, method: [PaymentMethod.UPI], source: [TransactionSource.SMS] },
  { name: 'Netflix', min: 649, max: 649, freq: 1, method: [PaymentMethod.CARD], source: [TransactionSource.SMS] },
  { name: 'BookMyShow', min: 400, max: 1200, freq: 2, method: [PaymentMethod.UPI], source: [TransactionSource.GMAIL] },
  { name: 'Decathlon', min: 899, max: 4499, freq: 1, method: [PaymentMethod.CARD], source: [TransactionSource.NFC], mcc: '5941',
    items: () => [{ name: 'Running Shoes Kalenji', qty: 1, unit: 2499 }, { name: 'Dry-fit T-shirt', qty: 2, unit: 499 }] },
  { name: 'Urban Company', min: 499, max: 1800, freq: 1, method: [PaymentMethod.UPI], source: [TransactionSource.GMAIL] },
  { name: 'Cult.fit', min: 1500, max: 1500, freq: 1, method: [PaymentMethod.CARD], source: [TransactionSource.SMS] },
];

/** Seeds (or re-seeds) the demo dataset. Returns the transaction count. */
export async function seedDemo(ds: DataSource, cfg: Pick<AppConfig, 'ENCRYPTION_KEY'>, log: (msg: string) => void = console.log): Promise<number> {
  // Deterministic PRNG so the demo looks the same on every machine.
  let seed = 20260917;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const occurredAtDaysAgo = (days: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    d.setUTCHours(between(3, 16), between(0, 59), 0, 0); // 08:30–21:30 IST
    return d;
  };

  const users = ds.getRepository(UserEntity);
  const households = ds.getRepository(HouseholdEntity);
  const categories = ds.getRepository(CategoryEntity);
  const txs = ds.getRepository(TransactionEntity);
  const budgets = ds.getRepository(BudgetEntity);
  const connections = ds.getRepository(ConnectionEntity);
  const terminals = ds.getRepository(PosTerminalEntity);

  const catBySlug = new Map<CategorySlug, CategoryEntity>();
  for (const [i, def] of CATEGORY_CATALOG.entries()) {
    let c = await categories.findOne({ where: { slug: def.slug } });
    if (!c) c = categories.create({ slug: def.slug, isCustom: false, userId: null });
    Object.assign(c, { name: def.name, icon: def.icon, color: def.color, sortOrder: i });
    catBySlug.set(def.slug, await categories.save(c));
  }

  for (const email of DEMO_EMAILS) {
    const u = await users.findOne({ where: { email } });
    if (u) {
      await txs.delete({ userId: u.id });
      await budgets.delete({ ownerId: u.id });
      await connections.delete({ userId: u.id });
      if (u.householdId) {
        await budgets.delete({ ownerId: u.householdId });
        await households.delete({ id: u.householdId });
      }
      await users.delete({ id: u.id });
    }
  }

  const household = await households.save(households.create({ name: 'The Sharmas', inviteCode: 'DEMO42' }));
  const demo = await users.save(
    users.create({
      email: 'demo@tapntally.app', name: 'Arjun Sharma', avatarUrl: null, googleSub: null,
      householdId: household.id, householdRole: HouseholdRole.OWNER, householdJoinedAt: new Date(Date.now() - 40 * 86400e3),
      aggregateInsightsConsent: true,
    }),
  );
  const priya = await users.save(
    users.create({
      email: 'priya@tapntally.app', name: 'Priya Sharma', avatarUrl: null, googleSub: null,
      householdId: household.id, householdRole: HouseholdRole.MEMBER, householdJoinedAt: new Date(Date.now() - 38 * 86400e3),
      aggregateInsightsConsent: true,
    }),
  );

  let terminal = await terminals.findOne({ where: { network: 'demo', terminalId: 'DEMO-001' } });
  if (!terminal) terminal = terminals.create({ network: 'demo', terminalId: 'DEMO-001', active: true, billsReceived: 0 });
  terminal.merchantName = 'Vidyarthi Bhavan';
  terminal.merchantGstin = null;
  terminal.encryptedSecret = encryptWith(cfg.ENCRYPTION_KEY, DEMO_TERMINAL_SECRET);
  await terminals.save(terminal);

  const weighted = MERCHANTS.flatMap((m) => Array<MerchantProfile>(m.freq).fill(m));
  let count = 0;
  for (const [user, days, perDay] of [[demo, 75, 1.1], [priya, 40, 0.7]] as const) {
    for (let day = 0; day < days; day++) {
      const n = rand() < perDay - Math.floor(perDay) ? Math.ceil(perDay) : Math.floor(perDay);
      for (let i = 0; i < n; i++) {
        const m = pick(weighted);
        const source = pick(m.source);
        const items = source === TransactionSource.NFC && m.items ? m.items(between) : [];
        const itemsPaise = items.map((it) => ({ name: it.name, qty: it.qty, unitPaise: it.unit * 100, totalPaise: it.qty * it.unit * 100 }));
        const amountPaise = itemsPaise.length ? itemsPaise.reduce((s, it) => s + it.totalPaise, 0) : between(m.min, m.max) * 100;
        const cat = categorize({ merchant: m.name, itemNames: items.map((it) => it.name), mcc: source === TransactionSource.NFC ? m.mcc : undefined });
        const isShared = [CategorySlug.GROCERIES, CategorySlug.BILLS_UTILITIES, CategorySlug.HOME].includes(cat.slug) || rand() < 0.15;
        const ref = `${source}-${user.id.slice(0, 8)}-${day}-${i}`;
        await txs.save(
          txs.create({
            userId: user.id, householdId: household.id, source,
            merchant: m.name, merchantKey: normalizeMerchant(m.name),
            amountPaise, currency: 'INR',
            categoryId: catBySlug.get(cat.slug)!.id, categoryConfidence: cat.confidence, categoryConfirmed: rand() < 0.3, categoryReason: cat.reason,
            paymentMethod: pick(m.method), items: itemsPaise, isShared, tags: [], notes: null,
            rawSourceRef: ref, dedupeKey: `seed:${ref}`, idempotencyKey: null,
            signatureVerified: source === TransactionSource.NFC, terminalNetwork: source === TransactionSource.NFC ? 'demo' : null,
            terminalId: source === TransactionSource.NFC ? 'DEMO-001' : null,
            occurredAt: occurredAtDaysAgo(day),
          }),
        );
        count++;
      }
    }
  }

  const b = (scope: BudgetScope, ownerId: string, slug: CategorySlug, rupees: number) =>
    budgets.save(budgets.create({ scope, ownerId, categoryId: catBySlug.get(slug)!.id, limitPaise: rupees * 100, period: BudgetPeriod.MONTHLY, alertThreshold: 0.8, lastAlertedPeriod: null }));
  await b(BudgetScope.USER, demo.id, CategorySlug.RESTAURANTS, 6000);
  await b(BudgetScope.USER, demo.id, CategorySlug.SHOPPING, 8000);
  await b(BudgetScope.USER, demo.id, CategorySlug.TRANSPORT, 3000);
  await b(BudgetScope.USER, priya.id, CategorySlug.RESTAURANTS, 4000);
  await b(BudgetScope.HOUSEHOLD, household.id, CategorySlug.GROCERIES, 12000);
  await b(BudgetScope.HOUSEHOLD, household.id, CategorySlug.BILLS_UTILITIES, 5000);

  await connections.save(connections.create({ userId: demo.id, type: ConnectionType.SMS, status: ConnectionStatus.ACTIVE, importedCount: 30, consecutiveFailures: 0, lastSyncedAt: new Date() }));

  log(`Seeded: 2 users, 1 household, ${count} transactions, 6 budgets, 1 demo terminal.`);
  return count;
}

/** Runtime hook: seed once per process when DEMO_AUTOSEED is on and the demo user is absent. */
export async function maybeAutoseed(app: INestApplicationContext, logger: LoggerService): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.DEMO_AUTOSEED) return;
  const ds = app.get(DataSource);
  const exists = await ds.getRepository(UserEntity).findOne({ where: { email: DEMO_EMAILS[0] } });
  if (exists) return;
  await seedDemo(ds, cfg, (m) => logger.log(m));
}

// ---- CLI ----
if (require.main === module) {
  loadDotenv({ path: ['.env', '.env.example'] });
  const cfg = loadConfig();
  (async () => {
    const ds = new DataSource({ ...buildDataSourceOptions(cfg), synchronize: cfg.DB_DRIVER === 'sqljs' || cfg.DB_SYNCHRONIZE });
    await ds.initialize();
    console.log(`Seeding (${cfg.DB_DRIVER})…`);
    await seedDemo(ds, cfg);
    console.log('Dev login:  POST /api/v1/auth/dev {"email":"demo@tapntally.app"}');
    await ds.destroy();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
