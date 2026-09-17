import { PaymentMethod } from '@tapntally/shared';
import { htmlToText, looksLikePurchase, parseEmail, senderDomain } from './gmail-parser';

describe('senderDomain', () => {
  it.each([
    ['Amazon.in <order-update@amazon.in>', 'amazon.in'],
    ['"Flipkart" <noreply@nct.flipkart.com>', 'flipkart.com'],
    ['IRCTC <ticketadmin@irctc.co.in>', 'irctc.co.in'],
    ['no-at-sign', null],
  ])('%s -> %s', (from, expected) => {
    expect(senderDomain(from)).toBe(expected);
  });
});

describe('looksLikePurchase', () => {
  it('accepts known sender + order keyword', () => {
    expect(looksLikePurchase('order-update@amazon.in', 'Your Amazon.in order #403-1234567 has been shipped')).toBe(true);
  });
  it('accepts unknown sender with strong subject keyword', () => {
    expect(looksLikePurchase('billing@localshop.example', 'Your invoice for September')).toBe(true);
  });
  it('rejects marketing and cancellations', () => {
    expect(looksLikePurchase('deals@amazon.in', 'Great Indian Sale: up to 70% off')).toBe(false);
    expect(looksLikePurchase('order-update@amazon.in', 'Your order has been cancelled')).toBe(false);
    expect(looksLikePurchase('noreply@myntra.com', 'Refund processed for your return')).toBe(false);
  });
});

describe('parseEmail', () => {
  const base = { messageId: 'm1', receivedAt: new Date('2026-09-10T10:00:00Z') };

  it('parses an Amazon order confirmation using Order Total', () => {
    const r = parseEmail({
      ...base,
      from: 'Amazon.in <auto-confirm@amazon.in>',
      subject: 'Your Amazon.in order of "boAt Airdopes 141" has been confirmed',
      body: [
        'Order #403-9876543-1234567',
        'boAt Airdopes 141 x1 ₹1,299.00',
        'Item Subtotal: ₹1,299.00',
        'Delivery: ₹0.00',
        'Order Total: ₹1,299.00',
        'Payment method: UPI',
      ].join('\n'),
    });
    expect(r).not.toBeNull();
    expect(r!.merchant).toBe('Amazon');
    expect(r!.amountPaise).toBe(129900);
    expect(r!.orderId).toBe('403-9876543-1234567');
    expect(r!.paymentMethod).toBe(PaymentMethod.UPI);
    expect(r!.items).toEqual([{ name: 'boAt Airdopes 141', qty: 1, unitPaise: 129900, totalPaise: 129900 }]);
  });

  it('prefers Grand Total over the first amount in the body', () => {
    const r = parseEmail({
      ...base,
      from: 'Flipkart <noreply@nct.flipkart.com>',
      subject: 'Order Confirmed: Samsung Galaxy M35',
      body: 'MRP Rs. 19,999\nDiscount Rs. 3,000\nGrand Total Rs. 16,999\nPaid via Card ending 1234',
    });
    expect(r!.amountPaise).toBe(1699900);
    expect(r!.merchant).toBe('Flipkart');
    expect(r!.paymentMethod).toBe(PaymentMethod.CARD);
  });

  it('parses a Swiggy receipt with Total Paid', () => {
    const r = parseEmail({
      ...base,
      from: 'Swiggy <noreply@swiggy.in>',
      subject: 'Your Swiggy order from Meghana Foods was delivered',
      body: 'Chicken Biryani x2 ₹640\nDelivery fee ₹30\nTotal Paid ₹690',
    });
    expect(r!.amountPaise).toBe(69000);
    expect(r!.items).toHaveLength(1);
    expect(r!.items[0]).toMatchObject({ name: 'Chicken Biryani', qty: 2, unitPaise: 32000, totalPaise: 64000 });
  });

  it('falls back to the subject amount', () => {
    const r = parseEmail({
      ...base,
      from: 'IRCTC <ticketadmin@irctc.co.in>',
      subject: 'Booking Confirmed - Rs. 1,240.00 - PNR 4512345678',
      body: 'Your e-ticket is attached.',
    });
    expect(r!.amountPaise).toBe(124000);
    expect(r!.merchant).toBe('IRCTC');
  });

  it('returns null for a purchase-looking email with no amount', () => {
    const r = parseEmail({ ...base, from: 'noreply@myntra.com', subject: 'Your order has been shipped', body: 'On its way!' });
    expect(r).toBeNull();
  });

  it('returns null for marketing', () => {
    const r = parseEmail({ ...base, from: 'deals@amazon.in', subject: 'Deals you will love', body: 'Rs. 499 only!' });
    expect(r).toBeNull();
  });
});

describe('htmlToText', () => {
  it('flattens tables and decodes the rupee entity', () => {
    const t = htmlToText('<table><tr><td>Order Total:</td><td>&#8377;1,299.00</td></tr></table><p>Thanks &amp; regards</p>');
    expect(t).toContain('Order Total: ₹1,299.00');
    expect(t).toContain('Thanks & regards');
  });
});
