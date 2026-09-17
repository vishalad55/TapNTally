// Vercel serverless entry. The real handler is compiled by `nest build` into
// dist/; this shim exists so Vercel's tracer follows a static require, and so
// hosted-demo defaults are in place before the config module loads.
/* eslint-disable @typescript-eslint/no-require-imports */
const { createHash } = require('node:crypto');

// Hosted DEMO defaults — every one of these is overridden by a real env var
// set in the Vercel dashboard.
//
// Secrets are *derived per deployment* (not random per cold start): the API
// runs as several serverless instances, and a token minted by one must verify
// on another. Deployment ids are semi-public, so this is acceptable only
// because the demo database is ephemeral seed data. Real deployments MUST set
// JWT_SECRET / ENCRYPTION_KEY / INTERNAL_API_KEY explicitly.
const deploymentSeed =
  [process.env.VERCEL_DEPLOYMENT_ID, process.env.VERCEL_PROJECT_ID, process.env.VERCEL_URL, process.env.VERCEL_GIT_COMMIT_SHA]
    .filter(Boolean)
    .join('|') || 'local-demo';
const derive = (label, bytes, encoding = 'base64') =>
  createHash('sha512').update(`tapntally-demo:${label}:${deploymentSeed}`).digest().subarray(0, bytes).toString(encoding);

const defaults = {
  DEMO_MODE: 'true',
  DEMO_AUTOSEED: 'true',
  AUTH_DEV_LOGIN: 'true',
  DB_DRIVER: 'sqljs',
  DB_SQLJS_FILE: ':memory:',
  DB_SYNCHRONIZE: 'true',
  NFC_REQUIRE_SIGNATURE: 'false',
  CORS_ORIGINS: '',
  JWT_SECRET: derive('jwt', 48),
  ENCRYPTION_KEY: derive('enc', 32),
  INTERNAL_API_KEY: derive('internal', 24, 'base64url'),
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
        node: process.version,
      }),
    );
    return;
  }
  return handler(req, res);
};
