import { PaymentMethod, type TbefBill, validateTbefBill } from '@tapntally/shared';
import { api } from '../api/client';
import type { NfcReader, NfcReadResult } from './types';

/**
 * Simulated terminal for demos and development.
 *
 * Default: asks the backend for a *signed* demo bill (the backend holds the
 * demo terminal's secret) so the "verified" path is exercised end to end.
 * `scenario` lets a presenter show failure handling on stage without a
 * real terminal misbehaving.
 */
export type MockScenario = 'signed' | 'unsigned' | 'malformed' | 'unsupported' | 'no_tag';

const SIMULATED_TAP_MS = 1400;

export class MockTerminal implements NfcReader {
  readonly kind = 'mock' as const;
  scenario: MockScenario = 'signed';
  private cancelled = false;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async read(opts: { onSessionStart?: () => void } = {}): Promise<NfcReadResult> {
    this.cancelled = false;
    opts.onSessionStart?.();
    await new Promise((r) => setTimeout(r, SIMULATED_TAP_MS));
    if (this.cancelled) return { status: 'cancelled', message: 'Scan cancelled.' };

    switch (this.scenario) {
      case 'no_tag':
        return { status: 'no_tag_found', message: "We didn't catch the bill. Hold your phone still against the terminal and try again." };
      case 'unsupported':
        return { status: 'unsupported_terminal', message: "This terminal isn't TapNTally-enabled yet." };
      case 'malformed':
        return { status: 'malformed_bill', message: 'The terminal sent a bill we could not read.', errors: ['totalPaise does not reconcile'] };
      case 'unsigned': {
        const bill = localUnsignedBill();
        return { status: 'success', bill, raw: JSON.stringify(bill) };
      }
      case 'signed':
      default: {
        try {
          const bill = await api<TbefBill>('/nfc/demo-bill');
          const v = validateTbefBill(bill);
          if (!v.ok) return { status: 'malformed_bill', message: 'Demo bill failed validation.', errors: v.errors };
          return { status: 'success', bill: v.bill, raw: JSON.stringify(v.bill) };
        } catch {
          // Offline or demo endpoint disabled → still demo the flow with a local bill.
          const bill = localUnsignedBill();
          return { status: 'success', bill, raw: JSON.stringify(bill) };
        }
      }
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
  }
}

const SAMPLES: Array<Pick<TbefBill, 'merchant' | 'items'>> = [
  {
    merchant: { name: 'Reliance Fresh - Koramangala', mcc: '5411', address: '80 Feet Rd, Bengaluru' },
    items: [
      { name: 'Amul Taaza Milk 1L', qty: 2, unitPaise: 6800, totalPaise: 13600 },
      { name: 'Aashirvaad Atta 5kg', qty: 1, unitPaise: 28500, totalPaise: 28500 },
      { name: 'Tomatoes (kg)', qty: 1.5, unitPaise: 4200, totalPaise: 6300 },
      { name: 'Tata Salt 1kg', qty: 1, unitPaise: 2800, totalPaise: 2800 },
    ],
  },
  {
    merchant: { name: 'Third Wave Coffee', mcc: '5814', address: 'Indiranagar, Bengaluru' },
    items: [
      { name: 'Flat White', qty: 2, unitPaise: 24000, totalPaise: 48000 },
      { name: 'Almond Croissant', qty: 1, unitPaise: 18000, totalPaise: 18000 },
    ],
  },
  {
    merchant: { name: 'Apollo Pharmacy', mcc: '5912', address: 'HSR Layout, Bengaluru' },
    items: [
      { name: 'Dolo 650 (15 tabs)', qty: 1, unitPaise: 3200, totalPaise: 3200 },
      { name: 'Vitamin D3 60k', qty: 4, unitPaise: 4500, totalPaise: 18000 },
      { name: 'Band-Aid (10)', qty: 1, unitPaise: 4000, totalPaise: 4000 },
    ],
  },
];

function localUnsignedBill(): TbefBill {
  const sample = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
  const subtotal = sample.items.reduce((s, i) => s + i.totalPaise, 0);
  const tax = Math.round(subtotal * 0.05);
  return {
    v: 1,
    billId: `MOCK-${Date.now().toString(36).toUpperCase()}`,
    issuedAt: new Date().toISOString(),
    currency: 'INR',
    merchant: sample.merchant,
    terminal: { network: 'mock', terminalId: 'MOCK-LOCAL' },
    items: sample.items,
    subtotalPaise: subtotal,
    taxPaise: tax,
    discountPaise: 0,
    totalPaise: subtotal + tax,
    paymentMethod: Math.random() > 0.5 ? PaymentMethod.CARD : PaymentMethod.CASH,
  };
}
