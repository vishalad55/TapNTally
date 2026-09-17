# Architecture

## Layers

```
mobile (Expo/RN)  ──HTTPS/JSON──▶  backend (NestJS)  ──TypeORM──▶  sql.js | PostgreSQL
      │                                 │
      │  @tapntally/shared              │  QueueService ──▶ in-process | BullMQ/Redis
      └── same enums, DTOs,             │  PushService  ──▶ log | FCM
          categoriser, TBEF validator   │  GmailClient  ──▶ Gmail API (readonly)
```

`shared` is compiled once and imported by both sides. Anything that must agree byte-for-byte between app, server and partner terminals (money rounding, merchant normalisation, TBEF canonical JSON, categorisation) lives there and is unit-tested there.

## The one ingest path

```
NFC tap ─┐
Partner ─┤
Gmail ───┼──▶ TransactionsService.ingest(IngestInput) ──▶ categorize() ──▶ dedupe ──▶ save ──▶ enqueue budget.check
SMS ─────┤
Manual ──┘
```

`IngestInput` carries source-specific hints (MCC from a terminal, subject line from an email, sender id from an SMS) that the categoriser uses in a fixed precedence: MCC → known merchant → merchant keyword → item keyword → free-text keyword → uncategorised, each with a confidence band the UI uses to nudge for confirmation.

De-duplication is by natural key (`dedupeKey`) plus optional client `idempotencyKey`, both unique-indexed; a lost race on insert is caught and resolved to the winning row.

## Data model

Entities in `backend/src/database/entities`. Highlights:

- `transactions.householdId` is denormalised from the user at write time (and rewritten on join/leave) so household feeds and household-budget sums are single-table queries.
- `transactions.items`/`tags` are JSON columns (`simple-json`) — portable across sql.js and Postgres. Move to `jsonb` when item-level querying is needed.
- `budgets` are unique per `(scope, ownerId, categoryId, period)`; `lastAlertedPeriod` makes the 80 % alert fire once per period.
- `connections.encryptedTokens` holds AES-GCM ciphertext; `gmailHistoryId` is the incremental-sync cursor.
- `pos_terminals` / `pos_partners` / `pairing_codes` form the partner layer.

## Background work

`QueueService` is an interface with two drivers picked by `REDIS_URL`. Handlers register in `onModuleInit` and must be idempotent (both drivers retry with backoff). Jobs:

| Job | Trigger | Does |
|---|---|---|
| `budget.check` | after any spend write (coalesced per user+category, 2 s delay) | computes progress, pushes an alert once per period |
| `gmail.backfill` | Gmail connect | scoped search over the last N days, parse, ingest, set history cursor, register watch |
| `gmail.sync` | Pub/Sub webhook or 30-min cron | `history.list` from cursor (falls back to a bounded search if the cursor expired) |
| `gmail.renewWatch` | 6-hourly cron | renews `users.watch` before its ≤7-day expiry |

## Security notes

- Config is validated at boot (`zod`); production refuses dev login, schema sync and non-Postgres drivers.
- JWT access tokens (15 min) + opaque refresh tokens (30 d, SHA-256 hashed at rest, rotated, reuse-revokes-family).
- `X-Internal-Key` (constant-time compare) guards operator endpoints; partner keys are hashed.
- Helmet, CORS allow-list, global rate limit, per-route tighter limits on auth.
- Email/SMS bodies never touch disk.

## Extending

- **New purchase source:** call `TransactionsService.ingest()` with a stable `dedupeKey`. Nothing else changes.
- **New category:** add to `CATEGORY_CATALOG` (seeded on boot) and rules to `MERCHANT_RULES`; add a test case.
- **New bank SMS template:** add a fixture to `sms-parser.spec.ts` first, then extend the patterns.
- **Partner network:** enrol terminals via `/internal/pos/terminals`; create a partner key via `/internal/pos/partners`.
