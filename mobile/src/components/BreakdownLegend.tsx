import { formatPaise } from '@tapntally/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon, categoryIconName } from '../theme/icons';
import { useMountProgress } from '../theme/motion';
import { tint } from '../theme/palette';
import type { DonutSelection, DonutSlice } from './DonutChart';
import { Row, Text } from './ui';

/**
 * The list half of the breakdown: one row per slice with a share bar. Stays in
 * sync with the donut (same selection), so a tap on either drives the feed.
 */
export function BreakdownLegend({ slices, selectedId, onSelect, initial = 4 }: { slices: DonutSlice[]; selectedId: string | null; onSelect: (s: DonutSelection | null) => void; initial?: number }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const grow = useMountProgress(900);
  const shown = expanded ? slices : slices.slice(0, initial);
  const max = Math.max(...slices.map((s) => s.share), 0.0001);

  return (
    <View style={{ gap: 4 }}>
      {shown.map((s) => {
        const active = s.id === selectedId;
        const dim = selectedId && !active;
        return (
          <Pressable
            key={s.id}
            onPress={() => onSelect(active ? null : { id: s.id, categoryIds: s.categoryIds, label: s.label, slug: s.slug })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 9,
              paddingHorizontal: 10,
              borderRadius: t.radius.md,
              backgroundColor: active ? tint(s.color, t.dark ? '2A' : '1A') : pressed ? t.colors.surfaceAlt : 'transparent',
              opacity: dim ? 0.5 : 1,
            })}
          >
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: tint(s.color, t.dark ? '2E' : '1F'), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.id === '__other' ? 'ellipsis-horizontal' : categoryIconName(s.slug)} size={17} color={s.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="heading" numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                  {s.label}
                </Text>
                <Text variant="money" style={{ fontSize: 14 }}>
                  {formatPaise(s.amountPaise, { showDecimals: false })}
                </Text>
              </Row>
              <Row gap={8}>
                <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(2, (s.share / max) * 100 * grow)}%`, height: '100%', backgroundColor: s.color, borderRadius: 3 }} />
                </View>
                <Text variant="caption" faint style={{ width: 36, textAlign: 'right' }}>
                  {Math.round(s.share * 100)}%
                </Text>
              </Row>
            </View>
          </Pressable>
        );
      })}
      {slices.length > initial ? (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 8 }}>
          <Row gap={4}>
            <Text variant="caption" color={t.colors.accent}>
              {expanded ? 'Show less' : `Show all ${slices.length}`}
            </Text>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={t.colors.accent} />
          </Row>
        </Pressable>
      ) : null}
    </View>
  );
}
