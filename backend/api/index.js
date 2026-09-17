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

// Load-time failures (a missing bundle file, a bad native dep) would otherwise
// surface only as an opaque FUNCTION_INVOCATION_FAILED; report them instead.
let handler;
let loadError;
try {
  ({ handler } = require('../dist/vercel-entry.js'));
} catch (err) {
  loadError = err;
  // eslint-disable-next-line no-console
  console.error('vercel-entry failed to load', err);
}

module.exports = (req, res) => {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        statusCode: 500,
        code: 'BOOT_LOAD_FAILED',
        message: String(loadError && loadError.message),
        stack: String(loadError && loadError.stack).split('\n').slice(0, 8),
        cwd: process.cwd(),
        node: process.version,
      }),
    );
    return;
  }
  return handler(req, res);
};
