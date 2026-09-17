import type { Transaction } from '@tapntally/shared';
import { formatPaise } from '@tapntally/shared';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useTheme } from '../theme';
import { Row, Sticker, Text } from './ui';

const FLASH_MS = 5500;

/**
 * The post-tap receipt: a paper slip with a torn top edge springs up, shows
 * the itemised bill for ~5.5 s behind a draining timer bar, then auto-dismisses
 * back to the dashboard. Tap anywhere to close early; "Edit" jumps to the purchase.
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
  const slide = useRef(new Animated.Value(700)).current;
  const drain = useRef(new Animated.Value(1)).current;
  const done = useRef(false);
  const [width, setWidth] = useState(340);

  const finish = (cb: () => void) => {
    if (done.current) return;
    done.current = true;
    Animated.timing(slide, { toValue: 800, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(cb);
  };

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 170 }).start();
    Animated.timing(drain, { toValue: 0, duration: FLASH_MS, easing: Easing.linear, useNativeDriver: false }).start();
    const timer = setTimeout(() => finish(onDone), FLASH_MS);
    return () => clearTimeout(timer);
    // Intentionally run once: the flash is a one-shot presentation.
    // eslint-disable-next-line
  }, []);

  const paper = t.dark ? t.colors.surface : '#FFFDF8';

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => finish(onDone)}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.scrim }]} />
      <Animated.View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 28,
          maxHeight: '78%',
          transform: [{ translateY: slide }],
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 16,
        }}
      >
        <Svg width={width} height={12} style={{ marginBottom: -1 }}>
          <Polygon points={tornEdge(width, 12)} fill={paper} />
        </Svg>
        <View style={{ backgroundColor: paper, borderBottomLeftRadius: t.radius.xl, borderBottomRightRadius: t.radius.xl, overflow: 'hidden' }}>
          <View style={{ height: 4, backgroundColor: t.colors.surfaceAlt }}>
            <Animated.View style={{ height: 4, backgroundColor: t.colors.accent, width: drain.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
          </View>
          <View style={{ padding: 22, gap: 14 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={12}>
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.colors.money + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22, color: t.colors.money }}>✓</Text>
                </View>
                <View>
                  <Text variant="title">Bill received</Text>
                  <Text variant="caption" muted>
                    Filed under {tx.category.icon} {tx.category.name}
                  </Text>
                </View>
              </Row>
              {verified ? <Sticker label="verified" color={t.colors.money} /> : <Sticker label="unverified" color={t.colors.inkFaint} />}
            </Row>

            <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: t.colors.border, paddingTop: 14, gap: 8 }}>
              <Text variant="heading">{tx.merchant}</Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {tx.items.map((it, i) => (
                  <Row key={i} style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
                    <Text style={{ flex: 1 }} numberOfLines={1}>
                      {it.name}
                      <Text muted> × {it.qty}</Text>
                    </Text>
                    <Text variant="money">{formatPaise(it.totalPaise)}</Text>
                  </Row>
                ))}
                {tx.items.length === 0 ? (
                  <Text muted variant="caption">
                    No line items on this bill.
                  </Text>
                ) : null}
              </ScrollView>
              <Row style={{ justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderStyle: 'dashed', borderColor: t.colors.border }}>
                <Text variant="heading">Total</Text>
                <Text variant="display">{formatPaise(tx.amountPaise)}</Text>
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
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** Zig-zag polygon points for a torn paper top edge. */
function tornEdge(width: number, height: number): string {
  const tooth = 12;
  const pts: string[] = [`0,${height}`];
  for (let x = 0; x <= width; x += tooth) pts.push(`${x},${x % (tooth * 2) === 0 ? 0 : height * 0.75}`);
  pts.push(`${width},${height}`);
  return pts.join(' ');
}
