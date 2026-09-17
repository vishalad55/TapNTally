import { TbefBillV1, canonicalizeTbef } from '@tapntally/shared';
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Compute the base64 HMAC-SHA256 signature a terminal should attach as `sig`. */
export function signTbef(bill: Omit<TbefBillV1, 'sig'>, secret: string): string {
  return createHmac('sha256', secret).update(canonicalizeTbef(bill as TbefBillV1)).digest('base64');
}

export function verifyTbef(bill: TbefBillV1, secret: string): boolean {
  if (!bill.sig) return false;
  const expected = Buffer.from(signTbef(bill, secret), 'base64');
  const provided = Buffer.from(bill.sig, 'base64');
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
