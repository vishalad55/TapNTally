import React, { type PropsWithChildren, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  type PressableProps,
  Text as RNText,
  type TextProps,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type TypographyVariant, typography, useTheme } from '../theme';
import { Icon, type IoniconName } from '../theme/icons';

/** Themed text with named variants from the design system. */
export function Text({
  variant = 'body',
  muted,
  faint,
  color,
  style,
  ...props
}: TextProps & { variant?: TypographyVariant; muted?: boolean; faint?: boolean; color?: string }) {
  const t = useTheme();
  const c = color ?? (faint ? t.colors.inkFaint : muted ? t.colors.inkMuted : t.colors.ink);
  return <RNText {...props} style={[typography[variant] as object, { color: c }, style]} />;
}

export function Screen({ children, style, padded = true, ...props }: ViewProps & { padded?: boolean }) {
  const t = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[{ flex: 1, backgroundColor: t.colors.bg }, style]} {...props}>
      <View style={{ flex: 1, paddingHorizontal: padded ? t.spacing(5) : 0 }}>{children}</View>
    </SafeAreaView>
  );
}

export function Card({ children, style, tone = 'surface', ...props }: ViewProps & { tone?: 'surface' | 'alt' | 'accent' }) {
  const t = useTheme();
  const bg = tone === 'accent' ? t.colors.accentSoft : tone === 'alt' ? t.colors.surfaceAlt : t.colors.surface;
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: bg,
          borderRadius: t.radius.lg,
          borderWidth: tone === 'surface' ? t.cardBorderWidth : 0,
          borderColor: t.colors.border,
          padding: t.spacing(4),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, style, gap = 8, ...props }: ViewProps & { gap?: number }) {
  return (
    <View {...props} style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {children}
    </View>
  );
}

export function Spacer({ h = 12 }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  style,
  icon,
  size = 'md',
  ...props
}: PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  icon?: IoniconName;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.colors.accent : variant === 'danger' ? t.colors.danger : variant === 'secondary' ? t.colors.surfaceAlt : 'transparent';
  const fg = variant === 'primary' ? t.colors.accentInk : variant === 'danger' ? '#FFFFFF' : t.colors.ink;
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        {...props}
        disabled={disabled || loading}
        onPressIn={() => press(0.96)}
        onPressOut={() => press(1)}
        style={{
          backgroundColor: bg,
          opacity: disabled ? 0.45 : 1,
          paddingVertical: size === 'sm' ? 9 : 15,
          paddingHorizontal: size === 'sm' ? 14 : 22,
          borderRadius: t.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        }}
      >
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
        <RNText style={[typography.heading, { color: fg }]}>{title}</RNText>
      </Pressable>
    </Animated.View>
  );
}

/** Circular icon button (header actions). */
export function IconButton({ name, onPress, label, size = 40 }: { name: IoniconName; onPress?: () => void; label: string; size?: number }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={name} size={Math.round(size * 0.5)} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: IoniconName;
}) {
  const t = useTheme();
  const accent = color ?? t.colors.accent;
  const onAccent = color ? '#FFFFFF' : t.colors.accentInk;
  const fg = selected ? onAccent : t.colors.ink;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: t.radius.pill,
        backgroundColor: selected ? accent : t.colors.surfaceAlt,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <RNText style={[typography.caption, { color: fg }]}>{label}</RNText>
    </Pressable>
  );
}

/** Rotated pill label — the "sticker" motif for VERIFIED / SHARED badges. */
export function Sticker({ label, color, tilt = -3 }: { label: string; color: string; tilt?: number }) {
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: color, transform: [{ rotate: `${tilt}deg` }] }}>
      <RNText style={[typography.micro, { color: contrastInk(color) }]}>{label}</RNText>
    </View>
  );
}

/** Flat pill for quieter labels (source badges, statuses). */
export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: color + '26' }}>
      <RNText style={[typography.micro, { color }]}>{label}</RNText>
    </View>
  );
}

export function EmptyState({ icon, title, body, children }: PropsWithChildren<{ icon: IoniconName; title: string; body?: string }>) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: t.spacing(10), paddingHorizontal: t.spacing(6), gap: 8 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Icon name={icon} size={36} color={t.colors.inkMuted} />
      </View>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text muted style={{ textAlign: 'center' }}>
          {body}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: t.spacing(8), alignItems: 'center', gap: 8 }}>
      <ActivityIndicator color={t.colors.accent} />
      {label ? <Text muted>{label}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <Card style={{ borderColor: t.colors.danger, borderWidth: 1, gap: 10 }}>
      <Row gap={8}>
        <Icon name="alert-circle-outline" color={t.colors.danger} />
        <Text style={{ flex: 1 }}>{message}</Text>
      </Row>
      {onRetry ? <Button title="Retry" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </Card>
  );
}

export function SectionHeader({ title, right, eyebrow }: { title: string; right?: React.ReactNode; eyebrow?: string }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: t.spacing(6), marginBottom: t.spacing(3) }}>
      <View>
        {eyebrow ? (
          <Text variant="micro" faint>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="title">{title}</Text>
      </View>
      {right}
    </Row>
  );
}

/** Fades + slides children in on mount. Used for list rows (staggered by index). */
export function Reveal({ children, index = 0, style }: PropsWithChildren<{ index?: number; style?: ViewStyle }>) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, delay: Math.min(index, 10) * 30, useNativeDriver: true }).start();
  }, [v, index]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** Black or white text for a given background hex. */
export function contrastInk(hex: string): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#15130F' : '#FFFFFF';
}
