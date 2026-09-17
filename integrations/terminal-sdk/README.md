# TapNTally Terminal Integration Kit

Everything a payment-terminal or billing-software partner needs to send itemised bills to TapNTally users. The wire format is **TBEF v1** (see [`docs/TBEF.md`](../../docs/TBEF.md)); this folder holds working reference code in three languages plus the Android tap (HCE) sketch.

## Two ways to deliver a bill

| Mode | When to use it | What the customer does | What the terminal does |
|---|---|---|---|
| **A. Tap (NFC)** | Android-based terminals (PAX, Pine Labs Plutus Smart, Paytm/PhonePe smart devices, Sunmi, Ingenico Axium) or any device with an NFC writer | Holds their phone on the contactless mark for a second | Presents the bill as a single NDEF record (`application/vnd.tapntally.bill+json`) via Host Card Emulation, or writes it to a tag |
| **B. Pairing code (server-to-server)** | Legacy terminals, web billing software, kiosks with no NFC | Opens *Settings → Pair with a terminal* and shows a 6-character code | Posts the bill with the code to `POST /api/v1/partner/bills` using the partner API key |

Both modes carry the same JSON; both are idempotent (re-sending the same `billId` never duplicates a purchase).

## Partner onboarding (what TapNTally does for you)

1. TapNTally creates a **partner record** and hands you a `tnt_…` API key (`POST /internal/pos/partners`, done by TapNTally staff).
2. For every physical terminal you enrol, TapNTally issues a **terminal secret** (`POST /internal/pos/terminals`). It is shown once; provision it onto the device or your bill server.
3. You sign every bill with that secret (`HMAC-SHA256` over canonical JSON). Signed bills show a **Verified** badge in the app; unsigned bills still work during pilots.

## Reference implementations

| Path | Language | What it shows |
|---|---|---|
| [`node/tapntally-terminal.js`](node/tapntally-terminal.js) | Node 18+ (no dependencies) | Build a bill, canonicalise, sign, produce the NDEF payload, POST via pairing code |
| [`python/tapntally_terminal.py`](python/tapntally_terminal.py) | Python 3.9+ (stdlib only) | Same as above for Python-based billing software |
| [`android/TapNTallyHceService.kt`](android/TapNTallyHceService.kt) | Kotlin | Host Card Emulation service that presents the bill as a Type 4 NDEF tag when a phone is tapped |
| [`examples/bill.example.json`](examples/bill.example.json) | JSON | A valid unsigned bill to test against |

### Try it against the hosted demo in two minutes

```bash
# 1. Get a pairing code in the app (Settings → Pair with a terminal), then:
node integrations/terminal-sdk/node/tapntally-terminal.js push \
  --api https://tap-n-tally-backend.vercel.app/api/v1 \
  --key tnt_demo_partner_key \
  --code ABC123 \
  --bill integrations/terminal-sdk/examples/bill.example.json
```

The demo API accepts the partner key `tnt_demo_partner_key` and the terminal secret `demo-terminal-secret-0001` (network `demo`, terminal `DEMO-001`). Production keys are issued per partner.

## Canonical JSON (must match exactly for signatures)

- Keys sorted recursively (`Object.keys().sort()` / `sort_keys=True`).
- No whitespace between tokens.
- Omit `sig` and any `undefined`/`null`-only optional fields you did not set.
- Numbers in shortest round-trip form (integers stay integers; no trailing `.0`).
- UTF-8, non-ASCII characters unescaped.

```
sig = base64( HMAC_SHA256( terminalSecret, canonicalJson(billWithoutSig) ) )
```

## Data you must never send

Full card numbers, CVV, expiry, UPI VPA of the customer, or any government ID. TapNTally is not a payment processor; bills contain **what was bought and for how much**, nothing about **how the card was paid**. Masked last-4 is not needed either.

## Support

Integration questions: open an issue in the repository or email the TapNTally partner desk (address in the go-live plan). Sandbox and production base URLs, rate limits (600 bills/min per partner key) and error codes are listed in `docs/TBEF.md`.
