#!/usr/bin/env node
/**
 * End-to-end smoke test against a running API (default http://localhost:3000).
 * Exercises the demo-user journey: sign in → dashboard → NFC tap (signed bill)
 * → idempotent retry → SMS ingest → budgets/recap/household → internal analytics.
 *
 *   node scripts/smoke.mjs [baseUrl] [internalKey]
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';
const INTERNAL_KEY = process.argv[3] ?? 'dev-internal-key';
const API = `${BASE}/api/v1`;

let failures = 0;
let last = null;
const ok = (label, cond, extra = '') => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${label}${extra ? `  ${extra}` : ''}`);
  if (!cond) {
    failures++;
    if (last) console.log(`      ↳ ${last.status} ${JSON.stringify(last.json).slice(0, 800)}`);
  }
};

async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(`${path.startsWith('http') ? '' : API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  last = { status: res.status, json };
  return last;
}

console.log(`Smoke test → ${BASE}\n`);

// 1. Health
const health = await call(`${BASE}/health`);
ok('GET /health', health.status === 200 && health.json?.database === 'ok', JSON.stringify(health.json));

// 2. Dev sign-in
const signIn = await call('/auth/dev', { method: 'POST', body: { email: 'demo@tapntally.app' } });
ok('POST /auth/dev', signIn.status === 200 && !!signIn.json?.tokens?.accessToken, `user=${signIn.json?.user?.name}`);
const token = signIn.json?.tokens?.accessToken;
const refreshToken = signIn.json?.tokens?.refreshToken;

// 3. Me
const me = await call('/users/me', { token });
ok('GET /users/me', me.status === 200 && me.json?.email === 'demo@tapntally.app', `household=${me.json?.householdId ? 'yes' : 'no'}`);

// 4. Dashboard data
const summary = await call('/transactions/summary', { token });
ok('GET /transactions/summary', summary.status === 200 && summary.json?.byCategory?.length > 0, `total=₹${(summary.json?.totalPaise / 100).toFixed(0)} cats=${summary.json?.byCategory?.length}`);

const list = await call('/transactions?limit=5', { token });
ok('GET /transactions', list.status === 200 && list.json?.items?.length === 5 && !!list.json?.nextCursor, `total=${list.json?.total}`);

const page2 = await call(`/transactions?limit=5&cursor=${encodeURIComponent(list.json?.nextCursor ?? '')}`, { token });
ok('GET /transactions (cursor page 2)', page2.status === 200 && page2.json?.items?.[0]?.id !== list.json?.items?.[0]?.id);

const search = await call('/transactions?q=swiggy', { token });
ok('GET /transactions?q=swiggy', search.status === 200 && search.json?.items?.every((t) => /swiggy/i.test(t.merchant)), `hits=${search.json?.items?.length}`);

const shared = await call('/transactions?scope=shared&limit=3', { token });
ok('GET /transactions?scope=shared', shared.status === 200 && shared.json?.items?.every((t) => t.isShared), `hits=${shared.json?.total}`);

// 5. Manual entry + edit + delete
const manual = await call('/transactions', { method: 'POST', token, body: { merchant: 'Chai Point', amountPaise: 12000, paymentMethod: 'upi' } });
ok('POST /transactions (manual)', manual.status === 201 && manual.json?.category?.slug === 'restaurants', `auto-cat=${manual.json?.category?.name} (${manual.json?.categoryConfidence})`);

const cats = await call('/categories', { token });
const groceries = cats.json?.find((c) => c.slug === 'groceries');
const edited = await call(`/transactions/${manual.json?.id}`, { method: 'PATCH', token, body: { categoryId: groceries?.id, tags: ['Office', 'office'], notes: 'team chai' } });
ok('PATCH /transactions/:id (override category)', edited.status === 200 && edited.json?.category?.slug === 'groceries' && edited.json?.categoryConfirmed === true && edited.json?.tags?.length === 1);

const del = await call(`/transactions/${manual.json?.id}`, { method: 'DELETE', token });
ok('DELETE /transactions/:id', del.status === 204);

// 6. NFC tap flow with a signed demo bill
const demoBill = await call('/nfc/demo-bill', { token });
ok('GET /nfc/demo-bill', demoBill.status === 200 && demoBill.json?.v === 1 && !!demoBill.json?.sig, `merchant=${demoBill.json?.merchant?.name}`);

const idem = `smoke-${Date.now()}`;
const tap1 = await call('/nfc/bills', { method: 'POST', token, body: { bill: demoBill.json, idempotencyKey: idem } });
ok('POST /nfc/bills (signed)', tap1.status === 200 && tap1.json?.created === true && tap1.json?.signatureVerified === true, `cat=${tap1.json?.transaction?.category?.name} items=${tap1.json?.transaction?.items?.length}`);

const tap2 = await call('/nfc/bills', { method: 'POST', token, body: { bill: demoBill.json, idempotencyKey: idem } });
ok('POST /nfc/bills (retry is idempotent)', tap2.status === 200 && tap2.json?.created === false && tap2.json?.transaction?.id === tap1.json?.transaction?.id);

const tampered = { ...demoBill.json, totalPaise: demoBill.json.totalPaise + 100, taxPaise: demoBill.json.taxPaise + 100, billId: 'TAMPERED-1' };
const tap3 = await call('/nfc/bills', { method: 'POST', token, body: { bill: tampered, idempotencyKey: `${idem}-t` } });
ok('POST /nfc/bills (tampered → unverified in pilot mode)', tap3.status === 200 && tap3.json?.signatureVerified === false);

const malformed = await call('/nfc/bills', { method: 'POST', token, body: { bill: { v: 1, billId: 'x' }, idempotencyKey: `${idem}-m` } });
ok('POST /nfc/bills (malformed → 422 NFC_MALFORMED_BILL)', malformed.status === 422 && malformed.json?.code === 'NFC_MALFORMED_BILL');

// 7. SMS ingest
const sms = await call('/connections/sms/ingest', {
  method: 'POST',
  token,
  body: {
    messages: [
      { id: `sms-${idem}-1`, sender: 'VM-HDFCBK', body: 'Rs.499.00 debited from A/c XX1234 on 12-09-26 to VPA swiggy.rzp@hdfcbank UPI Ref 625412345678', receivedAt: new Date().toISOString() },
      { id: `sms-${idem}-2`, sender: 'VM-HDFCBK', body: 'Your OTP for txn of Rs.499 at Swiggy is 123456. Do not share.', receivedAt: new Date().toISOString() },
      { id: `sms-${idem}-1`, sender: 'VM-HDFCBK', body: 'Rs.499.00 debited from A/c XX1234 on 12-09-26 to VPA swiggy.rzp@hdfcbank UPI Ref 625412345678', receivedAt: new Date().toISOString() },
    ],
  },
});
ok('POST /connections/sms/ingest', sms.status === 201 && sms.json?.parsed === 1 && sms.json?.skipped === 1 && sms.json?.duplicates === 1, JSON.stringify(sms.json));

// 8. Budgets, recap, household, connections
const budgets = await call('/budgets', { token });
ok('GET /budgets', budgets.status === 200 && budgets.json?.length >= 3 && budgets.json?.every((b) => typeof b.ratio === 'number'), budgets.json?.map((b) => `${b.budget.category.name}:${Math.round(b.ratio * 100)}%`).join(' '));

const upsert = await call('/budgets', { method: 'PUT', token, body: { scope: 'user', categoryId: groceries?.id, limitPaise: 500000 } });
ok('PUT /budgets', upsert.status === 200 && upsert.json?.budget?.limitPaise === 500000);

const recap = await call('/insights/recap?period=monthly', { token });
ok('GET /insights/recap', recap.status === 200 && typeof recap.json?.headline === 'string' && recap.json?.highlights?.length > 0, `"${recap.json?.headline}"`);

const household = await call('/households/me', { token });
ok('GET /households/me', household.status === 200 && household.json?.members?.length === 2, `${household.json?.name} ${household.json?.inviteCode}`);

const conns = await call('/connections', { token });
ok('GET /connections', conns.status === 200 && conns.json?.length === 2);

// 9. Token refresh + logout
const refreshed = await call('/auth/refresh', { method: 'POST', body: { refreshToken } });
ok('POST /auth/refresh', refreshed.status === 200 && !!refreshed.json?.accessToken);
const reuse = await call('/auth/refresh', { method: 'POST', body: { refreshToken } });
ok('POST /auth/refresh (reuse detected → 401)', reuse.status === 401 && reuse.json?.code === 'AUTH_REFRESH_REUSED');

// 10. Internal analytics (k-anonymity relaxed for the seeded demo)
const analytics = await call('/internal/analytics/category-trends?minCohort=1', { headers: { 'X-Internal-Key': INTERNAL_KEY } });
ok('GET /internal/analytics/category-trends', analytics.status === 200 && Array.isArray(analytics.json) && analytics.json.length > 0 && !('userId' in (analytics.json[0] ?? {})), `buckets=${analytics.json?.length}`);
const strict = await call('/internal/analytics/category-trends', { headers: { 'X-Internal-Key': INTERNAL_KEY } });
ok('GET /internal/analytics (default k=20 suppresses 2-user demo)', strict.status === 200 && strict.json?.length === 0);
const noKey = await call('/internal/analytics/consent');
ok('GET /internal/analytics without key → 401', noKey.status === 401);

console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
