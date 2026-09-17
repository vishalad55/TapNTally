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
  { slug: CategorySlug.GROCERIES, name: 'Groceries', icon: '🛒', color: '#0E9F6E' },
  { slug: CategorySlug.RESTAURANTS, name: 'Eating Out', icon: '🍽️', color: '#F28C28' },
  { slug: CategorySlug.SHOPPING, name: 'Shopping', icon: '🛍️', color: '#FF5A36' },
  { slug: CategorySlug.ELECTRONICS, name: 'Electronics', icon: '📱', color: '#3A6FF2' },
  { slug: CategorySlug.TRANSPORT, name: 'Transport', icon: '🚕', color: '#E6A100' },
  { slug: CategorySlug.FUEL, name: 'Fuel', icon: '⛽', color: '#A0673A' },
  { slug: CategorySlug.BILLS_UTILITIES, name: 'Bills & Utilities', icon: '💡', color: '#6B7A90' },
  { slug: CategorySlug.HEALTH, name: 'Health', icon: '💊', color: '#E2453C' },
  { slug: CategorySlug.ENTERTAINMENT, name: 'Entertainment', icon: '🎬', color: '#8B5CF6' },
  { slug: CategorySlug.EDUCATION, name: 'Education', icon: '📚', color: '#0EA5C9' },
  { slug: CategorySlug.TRAVEL, name: 'Travel', icon: '✈️', color: '#14B8A6' },
  { slug: CategorySlug.PERSONAL_CARE, name: 'Personal Care', icon: '💇', color: '#EC5FA5' },
  { slug: CategorySlug.HOME, name: 'Home', icon: '🏠', color: '#B08968' },
  { slug: CategorySlug.GIFTS_DONATIONS, name: 'Gifts & Donations', icon: '🎁', color: '#D946A8' },
  { slug: CategorySlug.FEES_CHARGES, name: 'Fees & Charges', icon: '🧾', color: '#7C8894' },
  { slug: CategorySlug.UNCATEGORIZED, name: 'Uncategorised', icon: '❓', color: '#A39C8D' },
];

export const CATEGORY_BY_SLUG: Readonly<Record<CategorySlug, CategoryDefinition>> =
  Object.fromEntries(CATEGORY_CATALOG.map((c) => [c.slug, c])) as Record<
    CategorySlug,
    CategoryDefinition
  >;
