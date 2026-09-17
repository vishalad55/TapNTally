# TapNTally

**Tap your phone after you pay. The bill files itself.**

TapNTally is an expense tracker for India built around one gesture: after paying at a shop (card *or* cash), the user taps their phone on the NFC-enabled POS terminal and the itemised bill lands in the app — categorised, budgeted, and shared with the household if they want. Online orders are captured from Gmail and SMS confirmations.

This repository is a working, production-shaped prototype intended for partner pitches (Paytm, Pine Labs, bank-issued terminals) and as the foundation a future engineering team builds on.

```
TapNTally/
├── shared/    TypeScript contract: enums, DTOs, money utils, categoriser, TBEF bill format + validator
├── backend/   NestJS API (TypeORM · sql.js for dev, PostgreSQL for prod · BullMQ or in-process jobs)
├── mobile/    Expo (React Native) app with expo-router — NFC, Gmail/SMS connections, budgets, family
└── docs/      Architecture notes and the TBEF partner integration spec
```

---

## Run it in five minutes (no Docker, no database install)

Requirements: Node ≥ 20, npm ≥ 10.

```bash
npm install
npm run build --workspace @tapntally/shared
npm run db:seed                     # creates backend/data/tapntally.sqlite with demo data
npm run dev:backend                 # API on http://localhost:3000  ·  Swagger at /docs
```

In a second terminal, prove it works end to end:

```bash
node backend/scripts/smoke.mjs
```

That runs the full demo journey against the live API — sign-in, dashboard, a **signed NFC bill**, idempotent retry, tamper detection, SMS parsing, budgets, recap, household, token-refresh replay detection, and the k-anonymous analytics layer — and prints ✓/✗ per step.

Then the app:

```bash
npm run dev:mobile                  # Expo dev server
```

Sign in with **demo@tapntally.app** (household owner) or **priya@tapntally.app** (member). The "Demo terminal" NFC mode is on automatically wherever real NFC isn't available, so the whole tap → receipt-flash → dashboard flow is demoable in a simulator or on any phone. Settings → NFC lets a presenter pick failure scenarios (missed tap, unsupported terminal, malformed bill) to show the error handling on stage.

> **Dev defaults.** With no `.env`, the backend reads `backend/.env.example` — dev-only secrets, `AUTH_DEV_LOGIN=true`, sql.js database, in-process queue, push notifications logged instead of sent. The config validator refuses to start in `NODE_ENV=production` with any of those still set.

---

## What's built

| Spec section | Where | Status |
|---|---|---|
| 3.1 Home dashboard — tappable donut filters the feed, persistent tap button | `mobile/app/(tabs)/index.tsx`, `DonutChart.tsx`, `NfcFab.tsx` | ✅ |
| 3.2 NFC tap flow — read → validate → post → 5.5 s itemised receipt flash → back home; graceful failures with retry | `mobile/src/nfc/*`, `TapFlow.tsx`, `ReceiptFlash.tsx`, `backend/.../nfc` | ✅ real reader + mock terminal |
| 3.3 Manual override — category, tags, notes, shared toggle; confidence nudge | `mobile/app/transaction/[id].tsx`, `PATCH /transactions/:id` | ✅ |
| 3.4 Gmail & SMS — narrow OAuth scope, on-device SMS filter, first-time backfill, push (Pub/Sub) + polling fallback | `backend/.../connections/*`, `mobile/app/connections.tsx`, `mobile/src/sms` | ✅ code complete; needs Google credentials to exercise live |
| 3.5 Budgets — per-category caps, green→amber→red, 80 % push alert, household budgets | `backend/.../budgets`, `mobile/app/(tabs)/budgets.tsx`, `budget-edit.tsx` | ✅ |
| 3.6 Insights recap — headline, biggest increase/saving, top merchant, priciest purchase | `backend/.../insights`, `mobile/app/(tabs)/insights.tsx` | ✅ |
| 3.7 Search & filter — instant merchant search, date/amount/category/method/source chips | `mobile/app/(tabs)/history.tsx`, `GET /transactions` | ✅ |
| 3.8 Family — invite code, per-purchase shared toggle, combined dashboard, household budgets | `backend/.../households`, `mobile/app/(tabs)/family.tsx` | ✅ |
| 5 Aggregation layer — consent-gated, k-anonymous (k=20) weekly trends by category/merchant | `backend/.../analytics` (`/internal/analytics/*`) | ✅ |
| 5 POS partner layer — terminal enrolment + HMAC verification, partner API keys, server-to-server bill push via pairing code | `backend/.../pos` (`/internal/pos/*`, `/partner/bills`) | ✅ |

### Verification performed

- `shared`: 55 unit tests (money, merchant normalisation, categoriser, TBEF validator/canonicaliser).
- `backend`: 38 unit tests (SMS parser, Gmail parser, IST period math, NFC ingest flow with signature/tamper/unknown-terminal cases) + the 27-step live smoke test above.
- `mobile`: full `tsc --noEmit` typecheck. **Not yet run on a device or emulator** — this machine has no Android SDK/Xcode. See "First device build" below.

---

## Architecture in one paragraph

Every transaction, regardless of origin — NFC bill, partner push, parsed email, parsed SMS, manual entry — goes through one function, `TransactionsService.ingest()`. That gives a single place for categorisation (the pure, tested `categorize()` in `shared`, so the app can run it too), de-duplication (natural keys like `nfc:<network>:<terminal>:<billId>` plus client idempotency keys), household denormalisation, and budget-alert scheduling on the job queue. Money is integer paise everywhere. Secrets at rest (Gmail tokens, terminal HMAC secrets) are AES-256-GCM encrypted. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Two things are deliberately swappable by config** so the prototype runs anywhere and still deploys properly:

| Concern | Dev / demo | Production |
|---|---|---|
| Database | `DB_DRIVER=sqljs` — single file, schema auto-synced | `DB_DRIVER=postgres` — migrations only (`npm run db:migrate`) |
| Jobs | in-process queue (retries, no Redis) | `REDIS_URL` → BullMQ workers |

---

## Backend

```bash
cd backend
npm run dev            # watch mode
npm test               # unit tests
npm run build          # → dist/
npm run db:seed        # demo data (idempotent — re-run to reset the demo users)
npm run db:migrate     # Postgres only
node scripts/smoke.mjs [baseUrl] [internalKey]
```

**Environment** — copy `.env.example` to `.env` and fill in for anything beyond local dev. Generate real secrets:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
```

**API surface** (all under `/api/v1`, Swagger at `/docs` in non-prod):

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/google` · `POST /auth/dev` (dev only) · `POST /auth/refresh` · `POST /auth/logout` |
| Me | `GET/PATCH /users/me` · `POST/DELETE /users/me/devices` (FCM tokens) |
| Transactions | `GET /transactions` (search/filter/cursor) · `GET /transactions/summary` · `POST` · `GET/PATCH/DELETE /transactions/:id` |
| NFC | `POST /nfc/bills` · `GET /nfc/demo-bill` (dev only) |
| Categories | `GET /categories` · `POST` · `DELETE /categories/:id` (custom only) |
| Budgets | `GET /budgets` (with progress) · `PUT /budgets` · `DELETE /budgets/:id` |
| Insights | `GET /insights/recap?period=weekly|monthly&scope=personal|shared` |
| Households | `GET /households/me` · `POST /households` · `POST /households/join` · `POST /households/leave` · `POST /households/invite/rotate` · `PATCH /households/me` |
| Connections | `GET /connections` · `POST/DELETE /connections/gmail` · `POST /connections/gmail/sync` · `POST/DELETE /connections/sms` · `POST /connections/sms/ingest` |
| POS (user) | `POST /pos/pairing-code` |
| Partner | `POST /partner/bills` — header `X-Partner-Key` |
| Internal | `/internal/analytics/{consent,category-trends,merchant-trends}` · `/internal/pos/{terminals,partners}` — header `X-Internal-Key` |
| Webhooks | `POST /webhooks/gmail?token=…` (Pub/Sub push; outside the `/api/v1` prefix) |

Errors always have the shape `{ statusCode, code, message, details? }` with stable codes (`NFC_MALFORMED_BILL`, `AUTH_REFRESH_REUSED`, …) the app branches on.

### Production deployment

`docker-compose.yml` runs Postgres + Redis + the API the way production should look:

```bash
cp backend/.env.example .env   # then set JWT_SECRET, ENCRYPTION_KEY, INTERNAL_API_KEY, GOOGLE_*
docker compose up --build
```

The image is a plain Node container (`backend/Dockerfile`) — deploy it to ECS/Cloud Run/App Service/anything; there is no vendor-specific code. Before the first Postgres deploy, verify the hand-written initial migration against a scratch database:

```bash
DB_DRIVER=postgres DATABASE_URL=postgres://… npm run db:migrate:generate --workspace @tapntally/backend
```

and diff the generated file against `backend/src/database/migrations/1758000000000-InitialSchema.ts`.

---

## Mobile

```bash
cd mobile
npm run start          # Expo dev server (expects a dev-client build; use start:go for Expo Go)
npm run typecheck
```

`app.json → extra.apiUrl` points at the API (default `http://localhost:3000/api/v1`; the client rewrites `localhost` for the Android emulator and for physical devices on the same LAN automatically).

### First device build

Native modules (NFC, Google Sign-In, SMS) need a **development build**, not Expo Go:

```bash
cd mobile
npx expo prebuild            # generates android/ and ios/ from app.json
npx expo run:android         # or run:ios (needs a Mac with Xcode + NFC entitlement in the Apple dev portal)
```

Or with EAS: `eas build --profile development --platform android`.

Without native modules present (Expo Go, web), the app still runs: NFC falls back to the demo terminal, Google sign-in is disabled until a client ID is set, and SMS is hidden on iOS.

### Google setup (sign-in + Gmail)

1. Google Cloud Console → create OAuth clients: **Web** (used as `webClientId`; its ID/secret go in the backend `GOOGLE_CLIENT_ID/SECRET`), **Android** (package `app.tapntally.mobile` + your signing SHA-1), **iOS** (bundle `app.tapntally.mobile`; put its reversed ID in `app.json` plugin config).
2. Enable the **Gmail API**. Add the `gmail.readonly` scope on the consent screen. While in testing mode add your demo accounts as test users.
3. Put the web client ID in `mobile/app.json → extra.googleWebClientId`.
4. Optional real-time sync: create a Pub/Sub topic, grant `gmail-api-push@system.gserviceaccount.com` publish rights, add a push subscription to `https://<api>/webhooks/gmail?token=<GMAIL_WEBHOOK_TOKEN>`, and set `GMAIL_PUBSUB_TOPIC`. Without it the 30-minute polling fallback keeps things in sync.

**Why `gmail.readonly` and not narrower:** `gmail.metadata` forbids the search (`q`) parameter we rely on to fetch *only* purchase emails from known senders/subjects; `readonly` is the least privilege that still keeps us out of the rest of the inbox. Bodies are parsed and discarded in the same tick; only the Gmail message id is stored for de-duplication.

### SMS

Android only (iOS has no SMS API — the UI says so). Messages are filtered on-device to bank/merchant sender IDs and payment-looking bodies, posted for parsing, and never stored. `READ_SMS` is a restricted permission on Google Play; for pilots use internal testing tracks or sideloaded builds, and plan the Play policy declaration before a public listing.

---

## Partner integration (POS terminals)

The contract terminals implement is the **TapNTally Bill Exchange Format (TBEF)** — an NDEF MIME record (`application/vnd.tapntally.bill+json`) with an optional HMAC-SHA256 signature. Full spec with worked example: [`docs/TBEF.md`](docs/TBEF.md).

Enrol a terminal (returns its secret once):

```bash
curl -X POST http://localhost:3000/api/v1/internal/pos/terminals -H "X-Internal-Key: dev-internal-key" \
  -H "Content-Type: application/json" \
  -d '{"network":"pinelabs","terminalId":"PL-88213","merchantName":"Reliance Fresh - Koramangala"}'
```

Terminals without NFC write support can push bills server-to-server with a partner API key and the 6-character pairing code the app shows at checkout (`POST /partner/bills`).

`NFC_REQUIRE_SIGNATURE=false` (pilot mode) accepts unsigned/unknown-terminal bills but marks them unverified; flip it on once partner rollouts begin.

---

## Data & privacy posture

- Integer paise everywhere; no floating-point money.
- Gmail OAuth tokens and terminal secrets: AES-256-GCM at rest, key in `ENCRYPTION_KEY`, version-prefixed ciphertext for rotation.
- Refresh tokens stored hashed; rotation with reuse detection (a replayed token revokes the whole session family).
- Raw email/SMS bodies are never persisted — only extracted fields plus an opaque source reference.
- Aggregate analytics: opt-in (`aggregateInsightsConsent`, default off), custom categories excluded, buckets under 20 distinct users suppressed, no user or transaction identifiers in output.

---

## Roadmap / known gaps

- **Device run.** The mobile app has been typechecked but not yet launched on hardware from this environment. First `expo prebuild` + run on an Android phone with NFC is the next milestone.
- **Placeholder icons.** `mobile/assets/*.png` are generated placeholders; replace with real branding.
- **Migration verification.** Regenerate the Postgres migration against a real database before the first prod deploy (see above).
- **Background SMS listening.** Today new SMS are scanned when the user opens Connections / taps "Scan new"; a foreground-service or WorkManager job would make it continuous.
- **ML categorisation.** The rules-based categoriser logs `categoryReason` and user corrections (`categoryConfirmed`) — the labelled data a future model needs.
- **Gmail parsing coverage.** Parsers are tested against representative Amazon/Flipkart/Swiggy/IRCTC shapes; expect to extend `TOTAL_PATTERNS` and `DOMAIN_NAMES` as real inboxes surface new templates. The unit tests are the safety net.
