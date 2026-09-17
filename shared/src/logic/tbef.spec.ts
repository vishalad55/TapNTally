import { PaymentMethod } from '../types/enums';
import { TbefBillV1 } from '../types/nfc';
import { canonicalizeTbef, validateTbefBill } from './tbef';

const validBill = (): TbefBillV1 => ({
  v: 1,
  billId: 'RF-KOR-000123',
  issuedAt: '2026-09-17T13:05:00+05:30',
  currency: 'INR',
  merchant: { name: 'Reliance Fresh - Koramangala', gstin: '29AABCR1718E1ZL', mcc: '5411' },
  terminal: { network: 'pinelabs', terminalId: 'PL-88213' },
  items: [
    { name: 'Amul Taaza Milk 1L', qty: 2, unitPaise: 6800, totalPaise: 13600 },
    { name: 'Bananas (Robusta)', qty: 1.2, unitPaise: 5000, totalPaise: 6000 },
  ],
  subtotalPaise: 19600,
  taxPaise: 0,
  discountPaise: 600,
  totalPaise: 19000,
  paymentMethod: PaymentMethod.CARD,
});

describe('validateTbefBill', () => {
  it('accepts a well-formed bill', () => {
    const r = validateTbefBill(validBill());
    expect(r.ok).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(validateTbefBill(null).ok).toBe(false);
    expect(validateTbefBill('hello').ok).toBe(false);
  });

  it('rejects unsupported versions', () => {
    const r = validateTbefBill({ ...validBill(), v: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/version/);
  });

  it('rejects float paise', () => {
    const r = validateTbefBill({ ...validBill(), totalPaise: 190.5 });
    expect(r.ok).toBe(false);
  });

  it('rejects when total does not reconcile', () => {
    const r = validateTbefBill({ ...validBill(), totalPaise: 99999 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/totalPaise/);
  });

  it('rejects when items do not sum to subtotal', () => {
    const r = validateTbefBill({ ...validBill(), subtotalPaise: 50000, totalPaise: 49400 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/items sum/);
  });

  it('tolerates ±1 paise per line rounding', () => {
    const b = validBill();
    b.subtotalPaise = 19601;
    b.totalPaise = 19001;
    expect(validateTbefBill(b).ok).toBe(true);
  });

  it('rejects non-INR', () => {
    expect(validateTbefBill({ ...validBill(), currency: 'USD' }).ok).toBe(false);
  });
});

describe('canonicalizeTbef', () => {
  it('is key-order independent and strips sig', () => {
    const a = validBill();
    const b: TbefBillV1 = { ...a, sig: 'abc' };
    const reordered = Object.fromEntries(
      Object.entries(b).reverse(),
    ) as unknown as TbefBillV1;
    expect(canonicalizeTbef(a)).toBe(canonicalizeTbef(reordered));
    expect(canonicalizeTbef(a)).not.toContain('"sig"');
  });
});
