import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { CategorySlug } from '@tapntally/shared';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { useTheme } from './index';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Category → line icon. Custom categories fall back to a tag. */
export const CATEGORY_ICONS: Record<CategorySlug | 'custom', IoniconName> = {
  groceries: 'cart-outline',
  restaurants: 'restaurant-outline',
  shopping: 'bag-handle-outline',
  electronics: 'phone-portrait-outline',
  transport: 'car-outline',
  fuel: 'speedometer-outline',
  bills_utilities: 'flash-outline',
  health: 'medkit-outline',
  entertainment: 'film-outline',
  education: 'school-outline',
  travel: 'airplane-outline',
  personal_care: 'cut-outline',
  home: 'home-outline',
  gifts_donations: 'gift-outline',
  fees_charges: 'receipt-outline',
  uncategorized: 'help-circle-outline',
  custom: 'pricetag-outline',
};

export function categoryIconName(slug: string | null | undefined): IoniconName {
  return (slug && CATEGORY_ICONS[slug as CategorySlug]) || CATEGORY_ICONS.custom;
}

export function Icon({ name, size = 20, color, style }: { name: IoniconName; size?: number; color?: string; style?: object }) {
  const t = useTheme();
  return <Ionicons name={name} size={size} color={color ?? t.colors.ink} style={style} />;
}

/** The brand mark: a contactless-payment glyph. */
export function TapGlyph({ size = 26, color }: { size?: number; color?: string }) {
  const t = useTheme();
  return <MaterialCommunityIcons name="contactless-payment" size={size} color={color ?? t.colors.ink} />;
}

/** Rounded tile with a category icon tinted by the category colour. */
export function CategoryTile({
  slug,
  color,
  size = 48,
  iconSize,
  radius,
}: {
  slug: string | null | undefined;
  color: string;
  size?: number;
  iconSize?: number;
  radius?: number;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size / 3),
        backgroundColor: color + (t.dark ? '2E' : '1F'),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={categoryIconName(slug)} size={iconSize ?? Math.round(size * 0.46)} color={color} />
    </View>
  );
}
