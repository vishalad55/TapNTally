import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '../theme';
import { Text } from './ui';

/**
 * The always-reachable tap button: 76 px accent disc with a soft breathing
 * halo. While a scan is active the halo becomes an expanding ring.
 */
export function NfcFab({ onPress, active }: { onPress: () => void; active?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    halo.setValue(0);
    const loop = Animated.loop(
      Animated.timing(halo, { toValue: 1, duration: active ? 1100 : 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [halo, active]);

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, active ? 1.9 : 1.35] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 0.7, 1], outputRange: [active ? 0.5 : 0.35, 0.12, 0] });

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 58 + insets.bottom, alignItems: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: t.colors.accent,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
      />
      <Pressable
        onPress={onPress}
        accessibilityLabel="Tap to get bill"
        style={({ pressed }) => ({
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: t.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.94 : 1 }],
          shadowColor: t.colors.accent,
          shadowOpacity: t.dark ? 0.55 : 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
          borderWidth: 5,
          borderColor: t.colors.bg,
        })}
      >
        <Text style={{ fontSize: 24, marginTop: -2 }}>📡</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 11, letterSpacing: 1.2, color: t.colors.accentInk }}>TAP</Text>
      </Pressable>
    </View>
  );
}
