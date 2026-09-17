import type { Transaction } from '@tapntally/shared';
import { CategoryConfidence, TransactionSource, formatPaise } from '@tapntally/shared';
import { format, isToday, isYesterday } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Row, Text } from './ui';

const SOURCE_BADGE: Record<TransactionSource, string> = {
  [TransactionSource.NFC]: 'NFC',
  [TransactionSource.GMAIL]: 'Gmail',
  [TransactionSource.SMS]: 'SMS',
  [TransactionSource.MANUAL]: 'Manual',
  [TransactionSource.POS_PARTNER]: 'POS',
};

export function friendlyDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, 'h:mm a')}`;
  return format(d, 'd MMM, h:mm a');
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
        gap: 12,
        paddingVertical: 12,
        opacity: pressed ? 0.7 : 1,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.colors.border,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: tx.category.color + '22',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 22 }}>{tx.category.icon}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading" numberOfLines={1}>
          {tx.merchant}
        </Text>
        <Row gap={6}>
          <Text variant="caption" muted numberOfLines={1}>
            {tx.category.name}
            {needsCheck ? ' · check?' : ''}
          </Text>
          <Text variant="caption" faint>
            · {friendlyDate(tx.occurredAt)}
          </Text>
        </Row>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Text variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
          {formatPaise(tx.amountPaise)}
        </Text>
        <Row gap={4}>
          {showShared && tx.isShared ? <Badge label="shared" color={t.colors.accent} /> : null}
          <Badge label={SOURCE_BADGE[tx.source]} color={t.colors.textFaint} />
        </Row>
      </View>
    </Pressable>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: color + '22' }}>
      <Text variant="caption" style={{ fontSize: 10, fontWeight: '700', color, letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
