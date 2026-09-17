# TapNTally — Go-Live Plan

*Written for the founder, not for engineers. Every step says who does it (you, a developer you hire, or Claude in this repo), roughly how long it takes, and what it costs. Technical detail lives in the linked files; you do not need to read those.*

Last updated: 18 September 2026.

---

## 1. Where things stand today

| Piece | Status | Where |
|---|---|---|
| Mobile app (iOS, Android, web) | Built. Demo runs at https://tapntally.vercel.app | `mobile/` |
| API (the server) | Built. Demo runs at https://tap-n-tally-backend.vercel.app in **demo mode** (fake in-memory data that resets) | `backend/` |
| Terminal integration format (TBEF) + partner SDK | Built, with reference code in Node, Python and Android | `docs/TBEF.md`, `integrations/terminal-sdk/` |
| First-run onboarding, terminal pairing codes, Gmail & SMS import, households, budgets, recap, push alerts | Built | in the app |
| Real database, real sign-in, app-store listings, a partner with live terminals, legal paperwork | **Not yet** | this plan |

"Going live" means turning the demo into a service real people rely on. That is mostly **accounts, decisions and partners**, not more code.

---

## 2. The three stages

| Stage | Goal | Users | Length |
|---|---|---|---|
| **A. Private pilot** | Prove the tap works in real shops with real bills | 20–50 friendly users, 3–5 shops | 6 weeks |
| **B. Public beta** | Anyone in one city can install and use it | up to 5,000 | 3 months |
| **C. Scale** | Multiple terminal partners, paid tiers, more cities | open | ongoing |

Do them in order. Stage A is cheap and teaches you the most.

---

## 3. Accounts and services you must create (Stage A)

You create these yourself; each takes 10–30 minutes with a card. Keep every login in a password manager and share access with your developer through it, never by chat.

| # | What | Why | Cost (approx.) |
|---|---|---|---|
| 1 | **Domain** e.g. `tapntally.app` (Namecheap / GoDaddy / Vercel Domains) | Your app and API addresses | ₹1,500–3,000 / year |
| 2 | **Vercel Pro** (you already have the free tier) | Hosts the web app and API with proper limits and logs | $20 / month |
| 3 | **Postgres database** — Neon or Supabase | Real, persistent data (the demo forgets everything on restart) | Free → $25 / month |
| 4 | **Redis** — Upstash | Background jobs (Gmail sync, budget alerts) | Free → $10 / month |
| 5 | **Google Cloud project** | Google sign-in and Gmail reading permission | Free |
| 6 | **Firebase project** (same Google account) | Push notifications | Free |
| 7 | **Apple Developer Program** | Publishing the iPhone app | $99 / year |
| 8 | **Google Play Console** | Publishing the Android app | $25 once |
| 9 | **Expo (EAS)** account | Builds the app binaries in the cloud so nobody needs a Mac | Free → $19 / month |
| 10 | **Sentry** | Tells you when the app crashes for someone | Free tier |
| 11 | **Google Workspace or Zoho mail** for `support@` and `partners@` | Stores need a real address to talk to | ₹150–500 / user / month |

Total for Stage A: **under ₹10,000 setup and roughly ₹5,000 / month.**

---

## 4. Turning the demo into a real service (developer work, ~2 weeks)

Your developer (or Claude, in this repo) does these. Each is already supported by the code; it is configuration and verification.

1. **Point the API at the real database and Redis.** In Vercel → project `tap-n-tally-backend` → *Settings → Environment Variables*, set `DB_DRIVER=postgres`, `DATABASE_URL`, `REDIS_URL`, and generate real `JWT_SECRET`, `ENCRYPTION_KEY`, `INTERNAL_API_KEY`. Set `DEMO_MODE=false`, `DEMO_AUTOSEED=false`, `AUTH_DEV_LOGIN=false`, `NFC_REQUIRE_SIGNATURE=true`. Run the database migrations once (`npm run db:migrate`).
2. **Google sign-in.** In Google Cloud create OAuth credentials for Android, iOS and Web; paste the web client id into `mobile/app.json → extra.googleWebClientId` and `GOOGLE_CLIENT_ID` on the server. Sign-in then replaces the demo login.
3. **Gmail permission (important, slow).** Reading order emails needs Google's *restricted scope* approval: a privacy policy page, a short video of the feature, and a security questionnaire. Budget **4–8 weeks** of waiting; start it in week 1. Until approved, only test accounts can connect Gmail.
4. **SMS on Android.** Google Play only allows SMS reading for a "core" use case with a declaration form. Ours qualifies as *financial transaction tracking with explicit user consent*; the app already shows a consent screen. Fill the form at submission time.
5. **Push notifications.** Create the Firebase app, download the service account JSON, set `FIREBASE_SERVICE_ACCOUNT` on the server.
6. **Custom domains.** `app.tapntally.app` → web app, `api.tapntally.app` → API; update `apiUrlProd` in `mobile/app.json`.
7. **Store builds.** `eas build --platform all` produces the binaries; `eas submit` uploads them. You need the store accounts from section 3 first.
8. **Monitoring.** Add the Sentry DSN to both app and server; set up an uptime ping on `/health` (Vercel's or a free service like Better Stack).

---

## 5. Terminal and billing-machine partners

This is the heart of TapNTally and the part only you can drive. Nobody taps a phone unless the card machine can hand over the bill.

### 5.1 How the integration works, in plain words

- A shop's card machine already knows every line of the bill (that's how it prints the receipt).
- After a sale, it either **broadcasts the bill over NFC** (the same radio used for tap-to-pay) or **sends it to our server with a 6-character code the customer shows**.
- Our app receives it, files it, and the customer sees it on their phone within seconds.
- The format is a small, signed JSON document called **TBEF**. The partner's engineers get a working sample in Node, Python and Android, and can test against our demo server in an afternoon. Nothing about the customer's card ever passes through us.

### 5.2 Who to approach (India), in order

| Partner type | Examples | Why they'd say yes | How to reach |
|---|---|---|---|
| **Smart POS makers / acquirers** (Android terminals) | Pine Labs (Plutus Smart), Paytm Soundbox+POS, PhonePe SmartSpeaker POS, Razorpay POS (Ezetap), Mswipe, BharatPe | Their terminals can run our HCE service; it becomes a feature they sell to merchants ("digital receipts") | Partnerships / product managers on LinkedIn; developer relations e-mail on their sites |
| **Billing software used at counters** | Vyapar, Zoho Books POS, Petpooja (restaurants), GoFrugal, Marg | Easiest technical path (server-to-server, pairing code); no hardware change | Integration marketplace / partner programs |
| **Retail chains with their own POS** | DMart, Reliance Retail, Nature's Basket, Third Wave, Blue Tokai | Direct pilot in 3–5 stores; they own the software | Head of digital / loyalty |
| **Terminal OEMs** | PAX, Ingenico, Verifone, Sunmi | Long-term; certify our HCE app on their platform | Later, once a partner is live |

Start with **one billing-software partner** (fastest) and **one chain of 3–5 stores** for the pilot.

### 5.3 What to offer a partner

- **For merchants:** digital itemised receipts with zero hardware change, fewer paper rolls, and an opt-in loyalty channel later.
- **For the partner:** a feature to sell; we sign a simple data agreement; integration costs them 1–2 developer days using our kit.
- **What we need from them:** a test terminal or sandbox, one engineer contact, and permission to enrol terminals (each gets its own signing secret).

### 5.4 The partner onboarding steps (what happens in the software)

1. TapNTally staff create the partner and hand over an API key (`POST /internal/pos/partners`).
2. Each terminal is enrolled and receives a signing secret shown once (`POST /internal/pos/terminals`).
3. Partner integrates using `integrations/terminal-sdk/` (Node/Python for server path, Kotlin for tap path).
4. They test against the demo server (`https://tap-n-tally-backend.vercel.app`) with the demo key `tnt_demo_partner_key`.
5. We flip `NFC_REQUIRE_SIGNATURE=true` for their network and watch the first 100 bills together.

### 5.5 Pilot script (Stage A, 6 weeks)

| Week | What happens |
|---|---|
| 1 | Sign the pilot agreement with one chain (3–5 stores). Enrol their terminals. Print a small counter sticker: "Tap your phone for the bill". |
| 2 | Partner's engineer integrates using the kit; we test in one store after hours. |
| 3–4 | 20–50 invited users install via TestFlight / Play internal testing. Measure: taps per day, bills received, categorisation accuracy (users correcting categories). |
| 5 | Fix what broke. Interview 10 users and 3 cashiers. |
| 6 | Decide go / no-go for public beta. Write the case study for the next partner. |

---

## 6. Onboarding new users (what the app does, and what you do)

**In the app (built):** sign in with Google → three-screen tour (what tapping is; connect Gmail/SMS or skip; create/join a household or skip) → Home. The tour is remembered on the account, so a second phone skips it. Users can replay it from Settings.

**Acquisition (you):**
1. Counter stickers and a QR code in pilot stores → app-store link.
2. A one-page website at the domain (Claude can generate it) with a 20-second video of a tap.
3. Referral inside households: creating a household produces an invite code; each invited member is a new user.

**Support (you, then a part-timer):** `support@` mailbox; a public help page with the five most common questions (tap didn't work → use pairing code; wrong category → tap the purchase and change it; Gmail not connecting → approval pending; how to delete my data; is my card safe → we never see card details).

---

## 7. Legal and compliance — India

You are **not** a payment company: no money moves through TapNTally, and no card numbers are ever received. That keeps you outside RBI payment licensing and outside PCI-DSS. What does apply:

| Item | What to do | When |
|---|---|---|
| **DPDP Act 2023** (data protection) | Privacy policy + in-app consent (already shown for Gmail/SMS/aggregate insights); a way to delete an account and all data (**to build** — listed in section 11); keep data in India-region databases (choose Mumbai region in Neon/Supabase) | Before public beta |
| **Google restricted-scope verification** (Gmail) | Privacy policy URL, homepage, demo video, CASA security assessment (self-assessment tier is free) | Start now; 4–8 weeks |
| **Play SMS permission declaration** | Form in Play Console; consent screen already in app | At submission |
| **Terms of service** | One page; cover: we are not a bank, data usage, partner data sharing (only what the user marks *shared* goes to their household; never to merchants) | Before public beta |
| **Company** | Register a Private Limited or LLP before signing partner agreements; GST registration once revenue starts | Before pilot agreement |
| **Trademark** | File "TapNTally" in class 9 & 42 | Any time; ~₹10,000 |

A startup-friendly lawyer can produce the policy, terms and pilot agreement in a week for ₹25,000–60,000.

---

## 8. Security checklist (developer, before public beta)

- [ ] `DEMO_MODE`, `AUTH_DEV_LOGIN`, `DEMO_AUTOSEED` all `false` in production
- [ ] Secrets generated with 32+ random bytes; rotated if ever pasted in chat
- [ ] `NFC_REQUIRE_SIGNATURE=true`; every live terminal enrolled with its own secret
- [ ] Database in Mumbai region, daily backups on, point-in-time recovery on
- [ ] Vercel Deployment Protection **off** for production URLs, **on** for previews
- [ ] Rate limits kept (already in code: 120 req/min per user, 600 bills/min per partner)
- [ ] Sentry receiving errors from app and API
- [ ] One person owns the on-call phone during pilot weeks

---

## 9. Money — a first budget

| Item | Stage A (pilot) | Stage B (beta) |
|---|---|---|
| Hosting & services (section 3) | ₹5,000 / month | ₹15,000–25,000 / month |
| Developer (contract) | ₹1.5–3 lakh for 3–4 weeks | 1 part-time developer, ₹80k–1.5 lakh / month |
| Legal | ₹40,000 one-off | ₹20,000 for updates |
| Stores & stickers, user incentives | ₹20,000 | ₹1–2 lakh (city launch) |
| Store accounts | ₹10,000 | — |
| **Total** | **≈ ₹3–4 lakh** | **≈ ₹3–5 lakh / month** |

Revenue ideas for Stage C, in order of ease: a paid family tier (₹99/month), a merchant tier for partners (digital receipts + loyalty), anonymised category trends sold as reports (only with the opt-in already built and the 20-person minimum group size).

---

## 10. Your personal checklist (in order)

1. [ ] Register the company; open a business bank account.
2. [ ] Buy the domain; create the eleven accounts in section 3; put every login in a password manager.
3. [ ] Hire a contract developer for 3–4 weeks **or** keep using Claude in this repository for section 4; either way, give them the accounts.
4. [ ] Start the Google Gmail verification (longest wait).
5. [ ] Approach one billing-software company and one retail chain with the one-pager (section 5.3) and the partner kit link.
6. [ ] Sign a pilot agreement; enrol terminals; put stickers at counters.
7. [ ] Invite 20–50 users through TestFlight and Play internal testing.
8. [ ] Run the six-week pilot script; keep a simple weekly sheet: taps, bills received, corrections, complaints.
9. [ ] Decide go / no-go; if go, submit to both stores and open the public beta.

---

## 11. What Claude can do next in this repository, on request

- Generate the one-page marketing site and the partner one-pager (PDF).
- Add the *Delete account* flow end-to-end and the privacy/terms pages inside the app.
- Write the EAS build and submit configuration for both stores.
- Produce the Postgres migration and a one-command production setup script.
- Add merchant-facing dashboards for partners (bills delivered per terminal).

Ask for any of these by name.
