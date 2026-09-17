import { createHash } from 'node:crypto';

/**
 * Deterministic UUID (v4 layout) from a natural key. Used for canonical
 * categories and seeded demo data so that independent instances of the API —
 * e.g. several serverless workers each holding an in-memory demo database —
 * agree on every id, and a token or deep link from one is valid on another.
 */
export function stableUuid(key: string): string {
  const h = createHash('sha256').update(`tapntally:${key}`).digest('hex').slice(0, 32).split('');
  h[12] = '4'; // version nibble
  h[16] = ['8', '9', 'a', 'b'][parseInt(h[16], 16) % 4]; // variant nibble
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
