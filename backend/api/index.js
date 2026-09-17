// Vercel serverless entry. The real handler is compiled by `nest build` into
// dist/; this shim exists so Vercel's tracer follows a static require, and so
// hosted-demo defaults are in place before the config module loads.
/* eslint-disable @typescript-eslint/no-require-imports */
const { randomBytes } = require('node:crypto');

// Hosted DEMO defaults — every one of these is overridden by a real env var
// set in the Vercel dashboard. Secrets fall back to per-cold-start random
// values, which is acceptable only because the demo database is ephemeral too.
const defaults = {
  DEMO_MODE: 'true',
  DEMO_AUTOSEED: 'true',
  AUTH_DEV_LOGIN: 'true',
  DB_DRIVER: 'sqljs',
  DB_SQLJS_FILE: ':memory:',
  DB_SYNCHRONIZE: 'true',
  NFC_REQUIRE_SIGNATURE: 'false',
  CORS_ORIGINS: '',
  JWT_SECRET: randomBytes(48).toString('base64'),
  ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  INTERNAL_API_KEY: randomBytes(24).toString('base64url'),
};
for (const [k, v] of Object.entries(defaults)) if (!process.env[k]) process.env[k] = v;

const { handler } = require('../dist/vercel-entry.js');
module.exports = handler;
