import React, { type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text as RNText,
  type TextProps,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { typography, useTheme } from '../theme';

/** Themed text with a small set of named variants. */
export function Text({
  variant = 'body',
  muted,
  faint,
  color,
  style,
  ...props
}: TextProps & { variant?: keyof typeof typography; muted?: boolean; faint?: boolean; color?: string }) {
  const t = useTheme();
  const c = color ?? (faint ? t.colors.textFaint : muted ? t.colors.textMuted : t.colors.text);
  return <RNText {...props} style={[typography[variant] as object, { color: c }, style]} />;
}

export function Screen({ children, style, padded = true, ...props }: ViewProps & { padded?: boolean }) {
  const t = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[{ flex: 1, backgroundColor: t.colors.background }, style]} {...props}>
      <View style={{ flex: 1, paddingHorizontal: padded ? t.spacing(4) : 0 }}>{children}</View>
    </SafeAreaView>
  );
}

export function Card({ children, style, ...props }: ViewProps) {
  const t = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: t.colors.surface,
          borderRadius: t.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
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
  ...props
}: PressableProps & { title: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; icon?: string; style?: ViewStyle }) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.colors.accent : variant === 'danger' ? t.colors.danger : variant === 'secondary' ? t.colors.surfaceElevated : 'transparent';
  const fg = variant === 'primary' ? t.colors.onAccent : variant === 'danger' ? '#fff' : t.colors.text;
  return (
    <Pressable
      {...props}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: t.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderColor: t.colors.border,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : null}
      {icon && !loading ? <RNText style={{ fontSize: 16 }}>{icon}</RNText> : null}
      <RNText style={[typography.heading, { color: fg }]}>{title}</RNText>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const t = useTheme();
  const accent = color ?? t.colors.accent;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: t.radius.pill,
        backgroundColor: selected ? accent : t.colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? accent : t.colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <RNText style={[typography.caption, { fontWeight: '600', color: selected ? '#fff' : t.colors.text }]}>{label}</RNText>
    </Pressable>
  );
}

export function EmptyState({ icon, title, body, children }: PropsWithChildren<{ icon: string; title: string; body?: string }>) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: t.spacing(10), paddingHorizontal: t.spacing(6), gap: 8 }}>
      <RNText style={{ fontSize: 44 }}>{icon}</RNText>
      <Text variant="heading" style={{ textAlign: 'center' }}>
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
    <Card style={{ borderColor: t.colors.danger, gap: 8 }}>
      <Text>{message}</Text>
      {onRetry ? <Button title="Retry" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: t.spacing(5), marginBottom: t.spacing(2) }}>
      <Text variant="heading">{title}</Text>
      {right}
    </Row>
  );
}
