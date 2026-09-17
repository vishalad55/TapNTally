/**
 * Column types that differ between the sql.js (dev) and Postgres (prod)
 * drivers. Decorators are evaluated at module load, so this reads the driver
 * from the environment directly — the one sanctioned exception to "only read
 * env via configuration.ts".
 */
const driver = process.env.DB_DRIVER === 'postgres' ? 'postgres' : 'sqljs';

export const DB = {
  driver,
  /** Absolute instant with timezone. */
  timestamp: driver === 'postgres' ? ('timestamptz' as const) : ('datetime' as const),
  /** Arbitrary JSON blob (items, tags). */
  json: 'simple-json' as const,
  /** Real number (alert thresholds). */
  real: driver === 'postgres' ? ('double precision' as const) : ('real' as const),
};
