import { PaymentMethod } from '../types/enums';
import { TbefBillV1, TbefLineItem } from '../types/nfc';

export type TbefValidation =
  | { ok: true; bill: TbefBillV1 }
  | { ok: false; errors: string[] };

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNonNegInt = (v: unknown): v is number => isInt(v) && v >= 0;
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function validateItem(item: unknown, idx: number, errors: string[]): item is TbefLineItem {
  if (!item || typeof item !== 'object') {
    errors.push(`items[${idx}] must be an object`);
    return false;
  }
  const it = item as Record<string, unknown>;
  if (!isStr(it.name)) errors.push(`items[${idx}].name required`);
  if (typeof it.qty !== 'number' || !(it.qty > 0)) errors.push(`items[${idx}].qty must be > 0`);
  if (!isNonNegInt(it.unitPaise)) errors.push(`items[${idx}].unitPaise must be a non-negative integer`);
  if (!isNonNegInt(it.totalPaise)) errors.push(`items[${idx}].totalPaise must be a non-negative integer`);
  return true;
}

/**
 * Structural validation of a bill read from a terminal. This runs on-device
 * *before* the receipt flash so the user gets an immediate "not a supported
 * bill" rather than a network round-trip. The backend re-validates and
 * additionally checks the HMAC signature.
 */
export function validateTbefBill(input: unknown): TbefValidation {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['bill must be an object'] };
  const b = input as Record<string, unknown>;

  if (b.v !== 1) errors.push(`unsupported version: ${String(b.v)}`);
  if (!isStr(b.billId)) errors.push('billId required');
  if (!isStr(b.issuedAt) || Number.isNaN(Date.parse(b.issuedAt))) errors.push('issuedAt must be ISO-8601');
  if (b.currency !== 'INR') errors.push('currency must be INR');

  const merchant = b.merchant as Record<string, unknown> | undefined;
  if (!merchant || typeof merchant !== 'object' || !isStr(merchant.name)) errors.push('merchant.name required');

  const terminal = b.terminal as Record<string, unknown> | undefined;
  if (!terminal || typeof terminal !== 'object' || !isStr(terminal.network) || !isStr(terminal.terminalId)) {
    errors.push('terminal.network and terminal.terminalId required');
  }

  if (!Array.isArray(b.items)) {
    errors.push('items must be an array');
  } else {
    b.items.forEach((it, i) => validateItem(it, i, errors));
  }

  for (const f of ['subtotalPaise', 'taxPaise', 'discountPaise', 'totalPaise'] as const) {
    if (!isNonNegInt(b[f])) errors.push(`${f} must be a non-negative integer`);
  }

  if (!Object.values(PaymentMethod).includes(b.paymentMethod as PaymentMethod)) {
    errors.push('paymentMethod invalid');
  }

  if (errors.length === 0) {
    const bill = b as unknown as TbefBillV1;
    const itemSum = bill.items.reduce((s, it) => s + it.totalPaise, 0);
    // Allow ±1 paise per line for terminal-side rounding of weighed goods.
    if (Math.abs(itemSum - bill.subtotalPaise) > bill.items.length) {
      errors.push(`items sum ${itemSum} does not match subtotalPaise ${bill.subtotalPaise}`);
    }
    const expectedTotal = bill.subtotalPaise + bill.taxPaise - bill.discountPaise;
    if (expectedTotal !== bill.totalPaise) {
      errors.push(`totalPaise ${bill.totalPaise} != subtotal + tax - discount (${expectedTotal})`);
    }
    if (bill.sig !== undefined && typeof bill.sig !== 'string') errors.push('sig must be a string');
  }

  return errors.length ? { ok: false, errors } : { ok: true, bill: b as unknown as TbefBillV1 };
}

/**
 * Canonical JSON used for signing: the bill minus `sig`, keys sorted
 * recursively, no whitespace. Both terminal SDK and backend must agree on
 * this byte-for-byte, hence it lives in `shared`.
 */
export function canonicalizeTbef(bill: TbefBillV1): string {
  const { sig: _sig, ...rest } = bill;
  return stableStringify(rest);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
