import type { CategorySpend } from '@tapntally/shared';
import { formatPaise } from '@tapntally/shared';
import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { Text } from './ui';

export interface DonutSelection {
  /** Slice id — a category id, or "__other" for the merged tail. */
  id: string;
  /** Category ids the slice covers (one, or several for "Other"). */
  categoryIds: string[];
  label: string;
  icon: string;
}

interface Props {
  data: CategorySpend[];
  totalPaise: number;
  selectedId: string | null;
  onSelect: (sel: DonutSelection | null) => void;
  periodLabel?: string;
  size?: number;
  thickness?: number;
}

/**
 * Tappable donut. Each slice is its own <Path> with a press handler; the
 * selected slice pops outward and the centre switches from the total to that
 * category. Slices under 2.5 % merge into "Other" so nothing is un-tappable.
 * Slices are separated by a thin gap in the ground colour for a crisp look.
 */
export function DonutChart({ data, totalPaise, selectedId, onSelect, periodLabel = 'this month', size = 250, thickness = 34 }: Props) {
  const t = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const inner = r - thickness;

  const slices = useMemo(() => {
    const MIN_SHARE = 0.025;
    const big = data.filter((d) => d.share >= MIN_SHARE);
    const small = data.filter((d) => d.share < MIN_SHARE);
    const merged = big.map((d) => ({
      id: d.category.id,
      label: d.category.name,
      icon: d.category.icon,
      color: d.category.color,
      amountPaise: d.amountPaise,
      share: d.share,
      categoryIds: [d.category.id],
    }));
    if (small.length) {
      merged.push({
        id: '__other',
        label: 'Other',
        icon: '•',
        color: t.colors.inkFaint,
        amountPaise: small.reduce((s, d) => s + d.amountPaise, 0),
        share: small.reduce((s, d) => s + d.share, 0),
        categoryIds: small.map((d) => d.category.id),
      });
    }
    let angle = -Math.PI / 2;
    return merged.map((m) => {
      const start = angle;
      const sweep = m.share * Math.PI * 2;
      angle += sweep;
      return { ...m, start, end: angle, mid: start + sweep / 2 };
    });
  }, [data, t.colors.inkFaint]);

  const selected = slices.find((s) => s.id === selectedId) ?? null;

  if (totalPaise === 0 || slices.length === 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r - thickness / 2} stroke={t.colors.surfaceAlt} strokeWidth={thickness} fill="none" />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text variant="display">₹0</Text>
          <Text muted variant="caption">
            nothing yet
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G>
          {slices.map((s) => {
            const isSel = selected?.id === s.id;
            const dim = selected && !isSel;
            const offset = isSel ? 8 : 0;
            const dx = Math.cos(s.mid) * offset;
            const dy = Math.sin(s.mid) * offset;
            const press = () => onSelect(isSel ? null : { id: s.id, categoryIds: s.categoryIds, label: s.label, icon: s.icon });
            return (
              <Path
                key={s.id}
                d={arcPath(cx + dx, cy + dy, r, inner, s.start, s.end)}
                fill={s.color}
                opacity={dim ? 0.3 : 1}
                stroke={t.colors.bg}
                strokeWidth={slices.length > 1 ? 3 : 0}
                {...{ [Platform.OS === 'web' ? 'onClick' : 'onPress']: press }}
              />
            );
          })}
        </G>
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', paddingHorizontal: 28 }}>
        {selected ? (
          <>
            <Text style={{ fontSize: 24 }}>{selected.icon}</Text>
            <Text variant="display" style={{ textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>
              {formatPaise(selected.amountPaise, { showDecimals: false })}
            </Text>
            <Text muted variant="caption" numberOfLines={1}>
              {selected.label} · {Math.round(selected.share * 100)}%
            </Text>
          </>
        ) : (
          <>
            <Text variant="micro" faint>
              {periodLabel}
            </Text>
            <Text variant="display" numberOfLines={1} adjustsFontSizeToFit>
              {formatPaise(totalPaise, { showDecimals: false })}
            </Text>
            <Text faint variant="caption">
              tap a slice
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

/** SVG path for an annular sector. Handles the 360° single-slice case. */
function arcPath(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number): string {
  const full = end - start >= Math.PI * 2 - 1e-6;
  if (full) end = start + Math.PI * 2 - 1e-4;
  const large = end - start > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  return [
    `M ${p(rOuter, start)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p(rOuter, end)}`,
    `L ${p(rInner, end)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p(rInner, start)}`,
    'Z',
  ].join(' ');
}
