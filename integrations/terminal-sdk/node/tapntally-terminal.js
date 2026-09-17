#!/usr/bin/env node
/**
 * TapNTally terminal reference client (Node 18+, zero dependencies).
 *
 *   const tnt = require('./tapntally-terminal');
 *   const bill = tnt.buildBill({ ... });                 // TBEF v1 object
 *   const signed = tnt.signBill(bill, terminalSecret);   // adds .sig
 *   const ndef = tnt.ndefPayload(signed);                // Buffer for NFC / HCE
 *   await tnt.pushBill({ apiBase, apiKey, pairingCode, bill: signed });
 *
 * CLI:
 *   node tapntally-terminal.js sign --secret <s> --bill bill.json
 *   node tapntally-terminal.js push --api <url> --key <tnt_…> --code <ABC123> --bill bill.json [--secret <s>]
 */
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');

const MIME = 'application/vnd.tapntally.bill+json';

/** Recursively sort keys and drop undefined values so JSON.stringify is canonical. */
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) out[key] = canonicalize(value[key]);
    }
    return out;
  }
  return value;
}

function canonicalJson(bill) {
  const { sig, ...rest } = bill;
  return JSON.stringify(canonicalize(rest));
}

function signBill(bill, terminalSecret) {
  const sig = crypto.createHmac('sha256', terminalSecret).update(canonicalJson(bill), 'utf8').digest('base64');
  return { ...bill, sig };
}

function verifyBill(bill, terminalSecret) {
  if (!bill.sig) return false;
  const expected = crypto.createHmac('sha256', terminalSecret).update(canonicalJson(bill), 'utf8').digest();
  const given = Buffer.from(bill.sig, 'base64');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/**
 * Build a TBEF v1 bill from plain inputs. Amounts are rupees here and
 * converted to integer paise; totals are computed so they always reconcile.
 */
function buildBill({ billId, merchant, terminal, items, taxRupees = 0, discountRupees = 0, paymentMethod = 'unknown', issuedAt = new Date() }) {
  const toPaise = (r) => Math.round(Number(r) * 100);
  const lines = items.map((it) => {
    const unitPaise = toPaise(it.unitRupees);
    const totalPaise = Math.round(unitPaise * it.qty);
    return { name: it.name, qty: it.qty, unitPaise, totalPaise, ...(it.sku ? { sku: it.sku } : {}), ...(it.gstRate !== undefined ? { gstRate: it.gstRate } : {}) };
  });
  const subtotalPaise = lines.reduce((s, l) => s + l.totalPaise, 0);
  const taxPaise = toPaise(taxRupees);
  const discountPaise = toPaise(discountRupees);
  return {
    v: 1,
    billId,
    issuedAt: issuedAt.toISOString(),
    currency: 'INR',
    merchant,
    terminal,
    items: lines,
    subtotalPaise,
    taxPaise,
    discountPaise,
    totalPaise: subtotalPaise + taxPaise - discountPaise,
    paymentMethod,
  };
}

/** Raw NDEF message (one MIME record) ready to write to a tag or return from an HCE READ. */
function ndefPayload(bill) {
  const type = Buffer.from(MIME, 'ascii');
  const payload = Buffer.from(JSON.stringify(bill), 'utf8');
  const short = payload.length < 256;
  // Flags: MB=1, ME=1, SR=short, TNF=0x02 (MIME media)
  const flags = 0x80 | 0x40 | (short ? 0x10 : 0) | 0x02;
  const header = [flags, type.length];
  const lenBytes = short ? Buffer.from([payload.length]) : Buffer.from([(payload.length >>> 24) & 255, (payload.length >>> 16) & 255, (payload.length >>> 8) & 255, payload.length & 255]);
  return Buffer.concat([Buffer.from(header), lenBytes, type, payload]);
}

/** Server-to-server delivery with a customer pairing code. Resolves to { transactionId, created, categorisedAs }. */
async function pushBill({ apiBase, apiKey, pairingCode, bill, fetchImpl = globalThis.fetch }) {
  const res = await fetchImpl(`${apiBase.replace(/\/$/, '')}/partner/bills`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-partner-key': apiKey },
    body: JSON.stringify({ pairingCode, bill }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`TapNTally rejected the bill: ${body.code ?? res.status} ${body.message ?? ''}`.trim());
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

module.exports = { MIME, canonicalJson, signBill, verifyBill, buildBill, ndefPayload, pushBill };

// ---- CLI -------------------------------------------------------------------
if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = Object.fromEntries(rest.map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
  const readBill = () => JSON.parse(fs.readFileSync(args.bill, 'utf8'));
  (async () => {
    if (cmd === 'sign') {
      process.stdout.write(JSON.stringify(signBill(readBill(), args.secret), null, 2) + '\n');
    } else if (cmd === 'push') {
      let bill = readBill();
      if (args.secret) bill = signBill(bill, args.secret);
      const out = await pushBill({ apiBase: args.api, apiKey: args.key, pairingCode: args.code, bill });
      console.log(JSON.stringify(out, null, 2));
    } else if (cmd === 'ndef') {
      process.stdout.write(ndefPayload(readBill()));
    } else {
      console.error('usage: tapntally-terminal.js <sign|push|ndef> --bill file [--secret s] [--api url --key k --code c]');
      process.exit(2);
    }
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
