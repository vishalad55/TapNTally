import type { CategorySpend } from '@tapntally/shared';
import { formatPaise } from '@tapntally/shared';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, type GestureResponderEvent, Pressable, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { Icon, categoryIconName } from '../theme/icons';
import { useMountProgress, useTween } from '../theme/motion';
import { catColor } from '../theme/palette';
import { Text } from './ui';

export interface DonutSelection {
  /** Slice id — a category id, or "__other" for the merged tail. */
  id: string;
  /** Category ids the slice covers (one, or several for "Other"). */
  categoryIds: string[];
  label: string;
  slug: string | null;
}

export interface DonutSlice extends DonutSelection {
  color: string;
  amountPaise: number;
  share: number;
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

const MIN_SHARE = 0.025;
const TAU = Math.PI * 2;
const START = -Math.PI / 2;

/** Slices sorted largest-first, tail merged into "Other" so nothing is un-tappable. */
export function buildSlices(data: CategorySpend[], color: (c: CategorySpend['category']) => string, otherColor: string): DonutSlice[] {
  const big = data.filter((d) => d.share >= MIN_SHARE);
  const small = data.filter((d) => d.share < MIN_SHARE);
  const out: DonutSlice[] = big.map((d) => ({
    id: d.category.id,
    label: d.category.name,
    slug: d.category.slug,
    color: color(d.category),
    amountPaise: d.amountPaise,
    share: d.share,
    categoryIds: [d.category.id],
  }));
  if (small.length) {
    out.push({
      id: '__other',
      label: 'Other',
      slug: null,
      color: otherColor,
      amountPaise: small.reduce((s, d) => s + d.amountPaise, 0),
      share: small.reduce((s, d) => s + d.share, 0),
      categoryIds: small.map((d) => d.category.id),
    });
  }
  return out;
}

/**
 * Selectable donut. Hit-testing is done on the container (angle + radius of
 * the tap), so it behaves identically on iOS, Android and web — no reliance
 * on per-path SVG events. The ring draws in on mount; the chosen slice lifts
 * outward and the centre cross-fades to that category.
 */
export function DonutChart({ data, totalPaise, selectedId, onSelect, periodLabel = 'this month', size = 236, thickness = 30 }: Props) {
  const t = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 12;
  const rInner = rOuter - thickness;
  const draw = useMountProgress(750);

  const slices = useMemo(() => buildSlices(data, (c) => catColor(c, t), t.colors.inkFaint), [data, t]);
  const arcs = useMemo(() => {
    let a = START;
    return slices.map((s) => {
      const start = a;
      a += s.share * TAU;
      return { ...s, start, end: a, mid: (start + a) / 2 };
    });
  }, [slices]);

  const selected = arcs.find((s) => s.id === selectedId) ?? null;
  const lift = useTween(selected ? 1 : 0, 260);

  // Cross-fade the centre when the selection changes.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0.2);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [selectedId, fade]);

  const box = useRef<View>(null);

  /** Tap point relative to the chart. Native events carry locationX/Y; on web we fall back to the DOM box. */
  const pointFor = (e: GestureResponderEvent): { x: number; y: number } | null => {
    const ne = e.nativeEvent as GestureResponderEvent['nativeEvent'] & { clientX?: number; clientY?: number; changedTouches?: Array<{ clientX: number; clientY: number }> };
    if (Number.isFinite(ne.locationX) && Number.isFinite(ne.locationY)) return { x: ne.locationX, y: ne.locationY };
    const src = ne.changedTouches?.[0] ?? ne;
    const el = box.current as unknown as { getBoundingClientRect?: () => { left: number; top: number } } | null;
    if (el?.getBoundingClientRect && Number.isFinite(src.clientX) && Number.isFinite(src.clientY)) {
      const r = el.getBoundingClientRect();
      return { x: (src.clientX as number) - r.left, y: (src.clientY as number) - r.top };
    }
    return null;
  };

  const onPress = (e: GestureResponderEvent) => {
    const p = pointFor(e);
    if (!p) return;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const r = Math.hypot(dx, dy);
    if (r < rInner - 4 || r > rOuter + 10) return onSelect(null);
    let a = Math.atan2(dy, dx);
    if (a < START) a += TAU;
    const hit = arcs.find((s) => a >= s.start && a < s.end);
    if (!hit) return;
    onSelect(hit.id === selectedId ? null : { id: hit.id, categoryIds: hit.categoryIds, label: hit.label, slug: hit.slug });
  };

  const empty = totalPaise === 0 || arcs.length === 0;

  return (
    <Pressable ref={box} onPress={onPress} accessibilityRole="image" accessibilityLabel="Spending by category" style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={rOuter - thickness / 2} stroke={t.colors.surfaceAlt} strokeWidth={thickness} fill="none" />
        <G>
          {!empty &&
            arcs.map((s) => {
              const isSel = selected?.id === s.id;
              const dim = selected && !isSel;
              const offset = isSel ? 7 * lift : 0;
              const ox = Math.cos(s.mid) * offset;
              const oy = Math.sin(s.mid) * offset;
              // Draw-in: scale every angle from the top by mount progress.
              const start = START + (s.start - START) * draw;
              const end = START + (s.end - START) * draw;
              if (end - start < 0.0005) return null;
              return (
                <Path
                  key={s.id}
                  d={arcPath(cx + ox, cy + oy, rOuter, rInner, start, end)}
                  fill={s.color}
                  opacity={dim ? 0.28 : 1}
                  stroke={t.colors.surface}
                  strokeWidth={arcs.length > 1 ? 2.5 : 0}
                />
              );
            })}
        </G>
      </Svg>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: thickness + 18, opacity: fade }}>
        {empty ? (
          <>
            <Text variant="display">₹0</Text>
            <Text muted variant="caption">
              nothing yet
            </Text>
          </>
        ) : selected ? (
          <>
            <Icon name={selected.id === '__other' ? 'ellipsis-horizontal' : categoryIconName(selected.slug)} size={20} color={selected.color} />
            <Text variant="display" numberOfLines={1} adjustsFontSizeToFit style={{ textAlign: 'center' }}>
              {formatPaise(selected.amountPaise, { showDecimals: false })}
            </Text>
            <Text muted variant="caption" numberOfLines={1} style={{ textAlign: 'center' }}>
              {selected.label} · {Math.round(selected.share * 100)}%
            </Text>
          </>
        ) : (
          <>
            <Text variant="micro" faint>
              {periodLabel}
            </Text>
            <Text variant="display" numberOfLines={1} adjustsFontSizeToFit style={{ textAlign: 'center' }}>
              {formatPaise(totalPaise, { showDecimals: false })}
            </Text>
            <Text faint variant="caption">
              tap a slice
            </Text>
          </>
        )}
      </Animated.View>
      {/* Invisible full-size hit layer keeps taps on the SVG reliable on web. */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }} />
    </Pressable>
  );
}

/** SVG path for an annular sector. Handles the 360° single-slice case. */
function arcPath(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number): string {
  if (end - start >= TAU - 1e-6) end = start + TAU - 1e-4;
  const large = end - start > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  return [`M ${p(rOuter, start)}`, `A ${rOuter} ${rOuter} 0 ${large} 1 ${p(rOuter, end)}`, `L ${p(rInner, end)}`, `A ${rInner} ${rInner} 0 ${large} 0 ${p(rInner, start)}`, 'Z'].join(' ');
}
