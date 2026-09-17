import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Text } from './ui';

/**
 * The always-reachable tap button. Fixed above the tab bar, pulses gently so
 * it reads as "the thing you do here".
 */
export function NfcFab({ onPress, active }: { onPress: () => void; active?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 64 + insets.bottom, alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale: active ? 1 : pulse }] }}>
        <Pressable
          onPress={onPress}
          accessibilityLabel="Tap to get bill"
          style={({ pressed }) => ({
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: active ? t.colors.accentStrong : t.colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.9 : 1,
            shadowColor: t.colors.accent,
            shadowOpacity: 0.45,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
            borderWidth: 4,
            borderColor: t.colors.background,
          })}
        >
          <Text style={{ fontSize: 26 }}>📡</Text>
          <Text variant="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }} color={t.colors.onAccent}>
            TAP
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
