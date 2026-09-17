import type { Category } from '@tapntally/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCategories } from '../api/hooks';
import { useTheme } from '../theme';
import { Loading, Text } from './ui';

/** Grid of category tiles. Used for overrides, manual entry and budgets. */
export function CategoryPicker({ value, onChange, compact }: { value: string | null; onChange: (c: Category) => void; compact?: boolean }) {
  const t = useTheme();
  const cats = useCategories();
  if (cats.isLoading) return <Loading />;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(cats.data ?? []).map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(c)}
            style={({ pressed }) => ({
              width: compact ? '30.5%' : '47.5%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: compact ? 8 : 12,
              paddingHorizontal: 10,
              borderRadius: t.radius.md,
              backgroundColor: selected ? c.color + '33' : t.colors.surface,
              borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
              borderColor: selected ? c.color : t.colors.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontSize: compact ? 16 : 20 }}>{c.icon}</Text>
            <Text variant={compact ? 'caption' : 'body'} style={{ flex: 1, fontWeight: selected ? '700' : '500' }} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
