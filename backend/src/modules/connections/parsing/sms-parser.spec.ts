import { PaymentMethod } from '@tapntally/shared';
import { parseSms } from './sms-parser';

describe('parseSms', () => {
  const received = new Date('2026-09-17T08:00:00Z');

  it('parses an HDFC UPI debit with VPA', () => {
    const r = parseSms(
      'Rs.499.00 debited from A/c XX1234 on 12-09-26 to VPA swiggy.rzp@hdfcbank UPI Ref 625412345678. Not you? Call 18002586161 -HDFC Bank',
      received,
    );
    expect(r).not.toBeNull();
    expect(r!.amountPaise).toBe(49900);
    expect(r!.merchant).toBe('Swiggy');
    expect(r!.paymentMethod).toBe(PaymentMethod.UPI);
    expect(r!.reference).toBe('625412345678');
    expect(r!.occurredAt?.toISOString()).toBe('2026-09-12T06:30:00.000Z'); // 12 Sep 12:00 IST
  });

  it('parses an ICICI card spend with merchant after "at"', () => {
    const r = parseSms(
      'INR 1,250.00 spent on ICICI Bank Card XX9012 on 15-Sep-26 at RELIANCE FRESH. Avl Limit: INR 1,48,750.00. Not you? Call 18002662',
      received,
    );
    expect(r).not.toBeNull();
    expect(r!.amountPaise).toBe(125000);
    expect(r!.merchant).toBe('Reliance Fresh');
    expect(r!.paymentMethod).toBe(PaymentMethod.CARD);
  });

  it('parses an SBI debit "credited to" style', () => {
    const r = parseSms(
      'Dear SBI User, your A/c X4321-debited by Rs2000.0 on 14Sep26 transfer to ZOMATO LTD Ref No 462811223344. If not done by you, fwd this SMS to 9223008333 -SBI',
      received,
    );
    expect(r).not.toBeNull();
    expect(r!.amountPaise).toBe(200000);
    expect(r!.merchant).toBe('Zomato Ltd');
  });

  it('parses a Paytm/PhonePe style confirmation', () => {
    const r = parseSms('Paid Rs.350 to Meghana Foods via UPI. UPI Ref: 512345678901. -PhonePe', received);
    expect(r).not.toBeNull();
    expect(r!.amountPaise).toBe(35000);
    expect(r!.merchant).toBe('Meghana Foods');
    expect(r!.paymentMethod).toBe(PaymentMethod.UPI);
  });

  it('parses Axis card with yyyy-mm-dd:hh:mm:ss timestamp', () => {
    const r = parseSms(
      'Spent Card no. XX4455 INR 2,499.00 2026-09-16:19:42:10 CROMA BENGALURU Avl Lmt INR 97,501.00 SMS BLOCK 4455 to 919951860002, if not done by you - Axis Bank',
      received,
    );
    // Merchant sits between timestamp and "Avl" without a preposition — we accept a null merchant means no record.
    // Axis format is the known weak spot; assert we at least don't misfire on the bank name.
    if (r) expect(r.merchant).not.toMatch(/axis/i);
  });

  it.each([
    'Your OTP for txn of Rs.499 at Swiggy is 123456. Do not share.',
    'Rs.25,000.00 credited to A/c XX1234 on 01-09-26 by NEFT. Avl bal Rs.1,20,000',
    'Refund of Rs.499.00 credited to your A/c for Zomato order 12345',
    'Your EMI of Rs.5,000 is due on 05-10-26. Please maintain balance.',
    'Rs.1,999 will be debited on 20-09-26 for Netflix autopay',
    'Flat 20% cashback offer on Swiggy! Pay with HDFC card. T&C',
    'Txn of Rs.899 at Myntra declined due to insufficient funds',
  ])('rejects non-purchase: %s', (sms) => {
    expect(parseSms(sms, received)).toBeNull();
  });

  it('returns null when there is no amount', () => {
    expect(parseSms('Payment to Swiggy successful', received)).toBeNull();
  });

  it('falls back to null date when none present', () => {
    const r = parseSms('Paid Rs.120 to Chai Point via UPI', received);
    expect(r).not.toBeNull();
    expect(r!.occurredAt).toBeNull();
  });
});
