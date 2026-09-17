import { CategorySlug } from '../types/enums';

export interface CategoryDefinition {
  slug: CategorySlug;
  name: string;
  icon: string;
  color: string;
}

/**
 * Canonical category catalogue. Order here is the default display order.
 * Colours are chosen to stay distinguishable on a pie chart with ~8 slices
 * and to hold up in both light and dark themes.
 */
export const CATEGORY_CATALOG: readonly CategoryDefinition[] = [
  { slug: CategorySlug.GROCERIES, name: 'Groceries', icon: '🛒', color: '#2E9E6B' },
  { slug: CategorySlug.RESTAURANTS, name: 'Eating Out', icon: '🍽️', color: '#E8743B' },
  { slug: CategorySlug.SHOPPING, name: 'Shopping', icon: '🛍️', color: '#C24E8A' },
  { slug: CategorySlug.ELECTRONICS, name: 'Electronics', icon: '📱', color: '#3F6FD8' },
  { slug: CategorySlug.TRANSPORT, name: 'Transport', icon: '🚕', color: '#E1B12C' },
  { slug: CategorySlug.FUEL, name: 'Fuel', icon: '⛽', color: '#8C5A2B' },
  { slug: CategorySlug.BILLS_UTILITIES, name: 'Bills & Utilities', icon: '💡', color: '#5B6B7F' },
  { slug: CategorySlug.HEALTH, name: 'Health', icon: '💊', color: '#D64545' },
  { slug: CategorySlug.ENTERTAINMENT, name: 'Entertainment', icon: '🎬', color: '#7B4DD6' },
  { slug: CategorySlug.EDUCATION, name: 'Education', icon: '📚', color: '#1F8FA5' },
  { slug: CategorySlug.TRAVEL, name: 'Travel', icon: '✈️', color: '#2AA5B8' },
  { slug: CategorySlug.PERSONAL_CARE, name: 'Personal Care', icon: '💇', color: '#E07AA9' },
  { slug: CategorySlug.HOME, name: 'Home', icon: '🏠', color: '#9B7A4A' },
  { slug: CategorySlug.GIFTS_DONATIONS, name: 'Gifts & Donations', icon: '🎁', color: '#D9534F' },
  { slug: CategorySlug.FEES_CHARGES, name: 'Fees & Charges', icon: '🧾', color: '#7F8C8D' },
  { slug: CategorySlug.UNCATEGORIZED, name: 'Uncategorised', icon: '❓', color: '#A0A4A8' },
];

export const CATEGORY_BY_SLUG: Readonly<Record<CategorySlug, CategoryDefinition>> =
  Object.fromEntries(CATEGORY_CATALOG.map((c) => [c.slug, c])) as Record<
    CategorySlug,
    CategoryDefinition
  >;
