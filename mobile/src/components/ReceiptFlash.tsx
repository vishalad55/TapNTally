import type { Transaction } from '@tapntally/shared';
import { formatPaise } from '@tapntally/shared';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Badge } from './TransactionRow';
import { Row, Text } from './ui';

const FLASH_MS = 5500;

/**
 * The post-tap receipt: slides up, shows the itemised bill for ~5.5s with a
 * draining progress bar, then auto-dismisses back to the dashboard. Tapping
 * anywhere dismisses early; "Edit" jumps to the transaction.
 */
export function ReceiptFlash({
  tx,
  verified,
  onDone,
  onEdit,
}: {
  tx: Transaction;
  verified: boolean;
  onDone: () => void;
  onEdit: () => void;
}) {
  const t = useTheme();
  const slide = useRef(new Animated.Value(600)).current;
  const drain = useRef(new Animated.Value(1)).current;
  const done = useRef(false);

  const finish = (cb: () => void) => {
    if (done.current) return;
    done.current = true;
    Animated.timing(slide, { toValue: 700, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(cb);
  };

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
    Animated.timing(drain, { toValue: 0, duration: FLASH_MS, easing: Easing.linear, useNativeDriver: false }).start();
    const timer = setTimeout(() => finish(onDone), FLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => finish(onDone)}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#00000088' }]} />
      <Animated.View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 32,
          maxHeight: '75%',
          backgroundColor: t.colors.surface,
          borderRadius: t.radius.xl,
          overflow: 'hidden',
          transform: [{ translateY: slide }],
        }}
      >
        <View style={{ height: 4, backgroundColor: t.colors.border }}>
          <Animated.View
            style={{
              height: 4,
              backgroundColor: t.colors.accent,
              width: drain.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
          />
        </View>
        <View style={{ padding: 20, gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={10}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>✓</Text>
              </View>
              <View>
                <Text variant="heading">Bill received</Text>
                <Text variant="caption" muted>
                  Filed under {tx.category.icon} {tx.category.name}
                </Text>
              </View>
            </Row>
            {verified ? <Badge label="verified" color={t.colors.accent} /> : <Badge label="unverified" color={t.colors.textFaint} />}
          </Row>

          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border, paddingTop: 12 }}>
            <Text variant="title">{tx.merchant}</Text>
            <ScrollView style={{ maxHeight: 220, marginTop: 8 }}>
              {tx.items.map((it, i) => (
                <Row key={i} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ flex: 1 }} numberOfLines={1}>
                    {it.name}
                    <Text muted> × {it.qty}</Text>
                  </Text>
                  <Text style={{ fontVariant: ['tabular-nums'] }}>{formatPaise(it.totalPaise)}</Text>
                </Row>
              ))}
              {tx.items.length === 0 ? (
                <Text muted variant="caption">
                  No line items on this bill.
                </Text>
              ) : null}
            </ScrollView>
            <Row style={{ justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border }}>
              <Text variant="heading">Total</Text>
              <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                {formatPaise(tx.amountPaise)}
              </Text>
            </Row>
          </View>

          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="caption" faint>
              Tap anywhere to close
            </Text>
            <Pressable onPress={() => finish(onEdit)} hitSlop={12}>
              <Text variant="heading" color={t.colors.accent}>
                Edit category →
              </Text>
            </Pressable>
          </Row>
        </View>
      </Animated.View>
    </Pressable>
  );
}
