import { formatPaise, paiseToRupees, parseAmountToPaise, rupeesToPaise } from './money';

describe('money', () => {
  it('round-trips rupees and paise without float drift', () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(paiseToRupees(1999)).toBe(19.99);
  });

  it('formats with Indian grouping', () => {
    expect(formatPaise(12345678)).toBe('₹1,23,456.78');
    expect(formatPaise(150000, { showDecimals: false })).toBe('₹1,500');
  });

  it('formats compact lakh/crore', () => {
    expect(formatPaise(25_000_000, { compact: true })).toBe('₹2.50L');
    expect(formatPaise(1_500_000_000, { compact: true })).toBe('₹1.50Cr');
    expect(formatPaise(150_000, { compact: true })).toBe('₹1.5K');
  });

  it.each([
    ['Rs. 1,234.50 debited from A/c', 123450],
    ['INR 499 spent on Swiggy', 49900],
    ['₹1,23,456.78 paid', 12345678],
    ['Rs 499/- via UPI', 49900],
    ['Amount: 2500 INR', 250000],
    ['no money here', null],
  ])('parses %s', (text, expected) => {
    expect(parseAmountToPaise(text)).toBe(expected);
  });
});
