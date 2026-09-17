# TapNTally Bill Exchange Format (TBEF) v1

The payload a POS terminal hands to a phone after a sale. This is the integration contract for terminal partners.

## Transport

- **NFC:** one NDEF message containing a single record  
  `TNF = MIME media (0x02)`, `type = application/vnd.tapntally.bill+json`, `payload = UTF-8 JSON` (below).  
  Works from a writable tag *or* Host Card Emulation presenting a Type 4 tag — the phone uses standard NDEF reading either way.
- **Server-to-server (no NFC write support):** `POST https://<api>/api/v1/partner/bills` with header `X-Partner-Key` and body `{ "pairingCode": "<6 chars shown in the app>", "bill": <same JSON> }`.

## JSON schema (v1)

```jsonc
{
  "v": 1,                                   // schema version, always 1
  "billId": "RF-KOR-000123",                // partner bill/invoice number; unique per terminal
  "issuedAt": "2026-09-17T13:05:00+05:30",  // ISO-8601 with offset
  "currency": "INR",                        // only INR accepted
  "merchant": {
    "name": "Reliance Fresh - Koramangala", // required
    "merchantId": "RIL-KOR-01",             // optional, partner-stable id
    "gstin": "29AABCR1718E1ZL",             // optional but strongly recommended
    "mcc": "5411",                          // optional ISO 18245 code — best categorisation signal
    "address": "80 Feet Rd, Bengaluru"      // optional
  },
  "terminal": {
    "network": "pinelabs",                  // partner network id, lowercase
    "terminalId": "PL-88213"                // partner TID
  },
  "items": [
    { "name": "Amul Taaza Milk 1L", "qty": 2,   "unitPaise": 6800, "totalPaise": 13600, "sku": "8901262010115", "gstRate": 0 },
    { "name": "Bananas (Robusta)",  "qty": 1.2, "unitPaise": 5000, "totalPaise": 6000 }
  ],
  "subtotalPaise": 19600,                   // Σ items.totalPaise (±1 paise per line tolerated)
  "taxPaise": 0,
  "discountPaise": 600,                     // positive number
  "totalPaise": 19000,                      // must equal subtotal + tax − discount
  "paymentMethod": "card",                  // card | cash | upi | net_banking | wallet | unknown
  "sig": "base64…"                          // optional HMAC-SHA256, see below
}
```

**All money fields are integer paise.** Floats are rejected.

## Signature

`sig = Base64( HMAC-SHA256( secret, canonical_json(bill without "sig") ) )`

Canonical JSON: keys sorted recursively, no whitespace, `undefined` fields omitted, numbers in shortest round-trip form. Reference implementation: `shared/src/logic/tbef.ts → canonicalizeTbef()`; signing helper: `backend/src/modules/nfc/tbef-signature.ts`.

The secret is issued per terminal at enrolment (`POST /internal/pos/terminals`) and shown exactly once. Bills that verify are marked `signatureVerified` on the user's transaction; in strict mode (`NFC_REQUIRE_SIGNATURE=true`) unsigned or failing bills are rejected with `NFC_BAD_SIGNATURE` / `NFC_UNKNOWN_TERMINAL`.

## Validation rules (enforced on device and on server)

| Rule | Error |
|---|---|
| `v === 1` | `unsupported version` |
| `billId`, `merchant.name`, `terminal.network`, `terminal.terminalId` non-empty | `… required` |
| `issuedAt` parses as ISO-8601 | `issuedAt must be ISO-8601` |
| every `*Paise` is a non-negative integer | `… must be a non-negative integer` |
| each item `qty > 0` | `items[i].qty must be > 0` |
| `|Σ item.totalPaise − subtotalPaise| ≤ items.length` | `items sum … does not match subtotalPaise` |
| `totalPaise === subtotalPaise + taxPaise − discountPaise` | `totalPaise … != …` |
| `paymentMethod` in the enum | `paymentMethod invalid` |

## Idempotency

The server de-duplicates on `nfc:<network>:<terminalId>:<billId>` (or `pos:` for partner pushes), so a re-tap or a retried POST never creates a second transaction. Clients additionally send a per-attempt `idempotencyKey`.

## Response (`POST /api/v1/nfc/bills`)

```json
{ "transaction": { "...": "..." }, "created": true, "signatureVerified": true }
```

`created: false` means the bill was already on file (safe to show "already recorded").
