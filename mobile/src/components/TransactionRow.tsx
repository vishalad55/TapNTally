import type { Transaction } from '@tapntally/shared';
import { CategoryConfidence, TransactionSource, formatPaise } from '@tapntally/shared';
import { format, isToday, isYesterday } from 'date-fns';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { CategoryTile } from '../theme/icons';
import { catColor } from '../theme/palette';
import { Badge, Row, Sticker, Text } from './ui';

export { Badge } from './ui';

const SOURCE_BADGE: Record<TransactionSource, string> = {
  [TransactionSource.NFC]: 'Tap',
  [TransactionSource.GMAIL]: 'Gmail',
  [TransactionSource.SMS]: 'SMS',
  [TransactionSource.MANUAL]: 'Manual',
  [TransactionSource.POS_PARTNER]: 'POS',
};

export function friendlyDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today · ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday · ${format(d, 'h:mm a')}`;
  return format(d, 'd MMM · h:mm a');
}

export function TransactionRow({ tx, onPress, showShared = true }: { tx: Transaction; onPress?: () => void; showShared?: boolean }) {
  const t = useTheme();
  const needsCheck = !tx.categoryConfirmed && tx.categoryConfidence !== CategoryConfidence.HIGH;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderRadius: t.radius.md,
        backgroundColor: pressed ? t.colors.surfaceAlt : 'transparent',
      })}
    >
      <CategoryTile slug={tx.category.slug} color={catColor(tx.category, t)} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text variant="heading" numberOfLines={1}>
          {tx.merchant}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {tx.category.name}
          {needsCheck ? <Text variant="caption" color={t.colors.warn}>{' · Review'}</Text> : null}
          <Text variant="caption" faint>{` · ${friendlyDate(tx.occurredAt)}`}</Text>
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <Text variant="money">{formatPaise(tx.amountPaise)}</Text>
        <Row gap={5}>
          {showShared && tx.isShared ? <Sticker label="shared" color={t.colors.pop} tilt={-4} /> : null}
          <Badge label={SOURCE_BADGE[tx.source]} color={tx.source === TransactionSource.NFC ? t.colors.money : t.colors.inkFaint} />
        </Row>
      </View>
    </Pressable>
  );
}
