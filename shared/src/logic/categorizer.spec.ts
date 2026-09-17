import { CategoryConfidence, CategorySlug } from '../types/enums';
import { categorize } from './categorizer';
import { normalizeMerchant, prettifyMerchant } from './merchant';

describe('normalizeMerchant', () => {
  it.each([
    ['Big Basket', 'bigbasket'],
    ['BIGBASKET', 'bigbasket'],
    ['SWIGGY*ORDER 123456', 'swiggy'],
    ['UPI-ZOMATO LTD-zomato@ptybl', 'zomato'],
    ['Amazon Pay India Pvt Ltd', 'amazon'],
    ['Reliance Fresh - Koramangala', 'reliancefreshkoramangala'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected);
  });
});

describe('prettifyMerchant', () => {
  it('title-cases shouty SMS merchant names', () => {
    expect(prettifyMerchant('RELIANCE FRESH KORAMANGALA')).toBe('Reliance Fresh Koramangala');
  });
  it('leaves mixed-case names alone', () => {
    expect(prettifyMerchant('Third Wave Coffee')).toBe('Third Wave Coffee');
  });
});

describe('categorize', () => {
  it('uses MCC with high confidence when present', () => {
    const r = categorize({ merchant: 'Random Shop', mcc: '5411' });
    expect(r.slug).toBe(CategorySlug.GROCERIES);
    expect(r.confidence).toBe(CategoryConfidence.HIGH);
  });

  it.each([
    ['Swiggy', CategorySlug.RESTAURANTS],
    ['SWIGGY INSTAMART', CategorySlug.GROCERIES],
    ['Zomato Ltd', CategorySlug.RESTAURANTS],
    ['BigBasket', CategorySlug.GROCERIES],
    ['Amazon Pay India', CategorySlug.SHOPPING],
    ['Flipkart Internet Pvt Ltd', CategorySlug.SHOPPING],
    ['Myntra Designs', CategorySlug.SHOPPING],
    ['Uber India Systems', CategorySlug.TRANSPORT],
    ['OLA CABS', CategorySlug.TRANSPORT],
    ['IRCTC', CategorySlug.TRANSPORT],
    ['MakeMyTrip', CategorySlug.TRAVEL],
    ['Indian Oil', CategorySlug.FUEL],
    ['Apollo Pharmacy', CategorySlug.HEALTH],
    ['BookMyShow', CategorySlug.ENTERTAINMENT],
    ['Netflix', CategorySlug.ENTERTAINMENT],
    ['Croma', CategorySlug.ELECTRONICS],
    ['Airtel Payments', CategorySlug.BILLS_UTILITIES],
    ['Urban Company', CategorySlug.PERSONAL_CARE],
    ['Meghana Foods', CategorySlug.RESTAURANTS],
    ['Chai Point', CategorySlug.RESTAURANTS],
  ])('known merchant %s -> %s (high)', (merchant, slug) => {
    const r = categorize({ merchant });
    expect(r.slug).toBe(slug);
    expect(r.confidence).toBe(CategoryConfidence.HIGH);
  });

  it.each([
    ['Sri Lakshmi Supermarket', CategorySlug.GROCERIES],
    ['Anand Foods', CategorySlug.RESTAURANTS],
    ['Corner Chai Stall', CategorySlug.RESTAURANTS],
    ['HSR Petrol Bunk - Fuel', CategorySlug.FUEL],
    ['City Hospital', CategorySlug.HEALTH],
    ['Bangalore Salon Studio', CategorySlug.PERSONAL_CARE],
  ])('keyword merchant %s -> %s (medium)', (merchant, slug) => {
    const r = categorize({ merchant });
    expect(r.slug).toBe(slug);
    expect(r.confidence).toBe(CategoryConfidence.MEDIUM);
  });

  it('falls back to item names for unknown merchants', () => {
    const r = categorize({ merchant: 'Sharma Traders', itemNames: ['Aashirvaad Atta 5kg', 'Amul Milk'] });
    // No keyword in item names here → uncategorised; then with a keyword:
    expect(r.slug).toBe(CategorySlug.UNCATEGORIZED);
    const r2 = categorize({ merchant: 'Sharma Traders', itemNames: ['Chicken Biryani x2'] });
    expect(r2.slug).toBe(CategorySlug.RESTAURANTS);
    expect(r2.confidence).toBe(CategoryConfidence.MEDIUM);
  });

  it('does not let short merchant keys match inside unrelated names', () => {
    // "ola" must not match "chocolate".
    const r = categorize({ merchant: 'Chocolate House' });
    expect(r.slug).not.toBe(CategorySlug.TRANSPORT);
  });

  it('returns uncategorised with low confidence when nothing matches', () => {
    const r = categorize({ merchant: 'XYZ 9987' });
    expect(r.slug).toBe(CategorySlug.UNCATEGORIZED);
    expect(r.confidence).toBe(CategoryConfidence.LOW);
    expect(r.reason).toBe('fallback');
  });
});
