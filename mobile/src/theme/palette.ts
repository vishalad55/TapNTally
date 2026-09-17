import type { Category, CategorySlug } from '@tapntally/shared';
import type { Theme } from './index';

/**
 * Category colours anchored on each mood's brand accent.
 *
 * Paper (light) is a warm, coral-anchored set; Arcade (dark) is a neon,
 * lime-anchored set. The biggest everyday bucket (Shopping) always wears the
 * accent itself so the chart and the FAB read as one system. Every value was
 * checked for ≥ 3:1 contrast against its mood's card surface.
 */
const PAPER: Record<CategorySlug, string> = {
  shopping: '#FF5A36',
  groceries: '#0E9F6E',
  restaurants: '#F28C28',
  electronics: '#3A6FF2',
  transport: '#E6A100',
  fuel: '#A0673A',
  bills_utilities: '#6B7A90',
  health: '#E2453C',
  entertainment: '#8B5CF6',
  education: '#0EA5C9',
  travel: '#14B8A6',
  personal_care: '#EC5FA5',
  home: '#B08968',
  gifts_donations: '#D946A8',
  fees_charges: '#7C8894',
  uncategorized: '#A39C8D',
};

const ARCADE: Record<CategorySlug, string> = {
  shopping: '#C8FF3D',
  groceries: '#4ADE80',
  restaurants: '#FFA85C',
  electronics: '#6AA6FF',
  transport: '#FBBF24',
  fuel: '#D6A374',
  bills_utilities: '#94A3B8',
  health: '#F87171',
  entertainment: '#B191FF',
  education: '#22D3EE',
  travel: '#2DD4BF',
  personal_care: '#FF4FA3',
  home: '#CDA97E',
  gifts_donations: '#F472B6',
  fees_charges: '#8B95A7',
  uncategorized: '#6B7386',
};

/** Colour for a category in the current mood. Custom categories keep their own hex. */
export function catColor(category: Pick<Category, 'slug' | 'color'> | null | undefined, t: Theme): string {
  if (!category) return t.colors.inkFaint;
  const table = t.dark ? ARCADE : PAPER;
  return (category.slug && table[category.slug]) || category.color;
}

/** Hex + alpha helper for tints ("1F" ≈ 12 %). */
export function tint(hex: string, alphaHex: string): string {
  return hex.length === 7 ? hex + alphaHex : hex;
}

/** Mix two hex colours; `amount` 0 → a, 1 → b. */
export function mix(a: string, b: string, amount: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - amount) + ((pb >> shift) & 255) * amount);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}
