import { PaymentMethod, TbefBillV1, TransactionSource } from '@tapntally/shared';
import { signTbef } from './tbef-signature';
import { NfcService } from './nfc.service';

/**
 * Integration-style test of the tap flow: validation → terminal lookup →
 * signature → ingest. Collaborators are stubbed so this runs without a DB.
 */
describe('NfcService.ingestBill', () => {
  const secret = 'terminal-secret';
  const me = { id: 'user-1', email: 'a@b.c', householdId: null };

  const bill = (): Omit<TbefBillV1, 'sig'> => ({
    v: 1,
    billId: 'B-1',
    issuedAt: '2026-09-17T10:00:00+05:30',
    currency: 'INR',
    merchant: { name: 'Reliance Fresh', mcc: '5411' },
    terminal: { network: 'pinelabs', terminalId: 'T-1' },
    items: [{ name: 'Milk', qty: 1, unitPaise: 6000, totalPaise: 6000 }],
    subtotalPaise: 6000,
    taxPaise: 0,
    discountPaise: 0,
    totalPaise: 6000,
    paymentMethod: PaymentMethod.CARD,
  });

  function build(opts: { requireSig: boolean; terminalKnown: boolean }) {
    const ingest = jest.fn(async (input) => ({ transaction: { id: 'tx-1', ...input }, created: true }));
    const increment = jest.fn();
    const svc = new NfcService(
      { get: (k: string) => (k === 'NFC_REQUIRE_SIGNATURE' ? opts.requireSig : undefined) } as never,
      { decrypt: (v: string) => v.replace('enc:', '') } as never,
      { ingest } as never,
      {
        findOne: async () =>
          opts.terminalKnown ? { id: 't', active: true, encryptedSecret: `enc:${secret}` } : null,
        increment,
      } as never,
    );
    return { svc, ingest, increment };
  }

  it('accepts a signed bill from an enrolled terminal and marks it verified', async () => {
    const { svc, ingest, increment } = build({ requireSig: true, terminalKnown: true });
    const signed = { ...bill(), sig: signTbef(bill(), secret) };
    const out = await svc.ingestBill(me, signed, 'idem-1');
    expect(out.signatureVerified).toBe(true);
    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: TransactionSource.NFC,
        amountPaise: 6000,
        mcc: '5411',
        dedupeKey: 'nfc:pinelabs:T-1:B-1',
        idempotencyKey: 'idem-1',
      }),
    );
    expect(increment).toHaveBeenCalled();
  });

  it('rejects a tampered bill when signatures are required', async () => {
    const { svc } = build({ requireSig: true, terminalKnown: true });
    const signed = { ...bill(), sig: signTbef(bill(), secret) };
    signed.totalPaise = 5000;
    signed.subtotalPaise = 5000;
    signed.items[0].totalPaise = 5000;
    await expect(svc.ingestBill(me, signed, 'idem-2')).rejects.toMatchObject({ code: 'NFC_BAD_SIGNATURE' });
  });

  it('accepts an unsigned bill from an unknown terminal in pilot mode', async () => {
    const { svc } = build({ requireSig: false, terminalKnown: false });
    const out = await svc.ingestBill(me, bill(), 'idem-3');
    expect(out.signatureVerified).toBe(false);
    expect(out.created).toBe(true);
  });

  it('rejects unknown terminals in strict mode', async () => {
    const { svc } = build({ requireSig: true, terminalKnown: false });
    await expect(svc.ingestBill(me, bill(), 'idem-4')).rejects.toMatchObject({ code: 'NFC_UNKNOWN_TERMINAL' });
  });

  it('rejects malformed payloads with a readable error list', async () => {
    const { svc } = build({ requireSig: false, terminalKnown: false });
    await expect(svc.ingestBill(me, { v: 1, billId: 'x' }, 'idem-5')).rejects.toMatchObject({
      code: 'NFC_MALFORMED_BILL',
    });
  });
});
