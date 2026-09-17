import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '../theme';
import type { IoniconName } from '../theme/icons';

export const TAB_ICONS: Record<string, { outline: IoniconName; filled: IoniconName; label: string }> = {
  index: { outline: 'home-outline', filled: 'home', label: 'Home' },
  history: { outline: 'receipt-outline', filled: 'receipt', label: 'History' },
  budgets: { outline: 'pie-chart-outline', filled: 'pie-chart', label: 'Budgets' },
  insights: { outline: 'sparkles-outline', filled: 'sparkles', label: 'Recap' },
  family: { outline: 'people-outline', filled: 'people', label: 'Family' },
};

/** Structural subset of React Navigation's BottomTabBarProps — avoids pinning a second copy of the library's types. */
export interface TabBarProps {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

/** Height of the bar excluding the safe-area inset. Shared with the FAB. */
export const TAB_BAR_HEIGHT = 64;

/**
 * Five equal columns — two tabs, an empty centre column under the floating
 * tap button, two tabs — so spacing is symmetric regardless of label width.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TAB_ICONS[r.name]);
  const slots = [...routes.slice(0, 2), null, ...routes.slice(2)];

  return (
    <View
      style={{
        flexDirection: 'row',
        height: TAB_BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: t.colors.surface,
        borderTopWidth: t.cardBorderWidth,
        borderTopColor: t.colors.border,
      }}
    >
      {slots.map((route, i) => {
        if (!route) return <View key="spacer" style={{ flex: 1 }} />;
        const focused = state.routes[state.index]?.key === route.key;
        const meta = TAB_ICONS[route.name];
        const onPress = () => {
          const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);
        };
        return <Tab key={route.key} index={i} focused={focused} meta={meta} onPress={onPress} />;
      })}
    </View>
  );
}

function Tab({ focused, meta, onPress }: { index: number; focused: boolean; meta: (typeof TAB_ICONS)[string]; onPress: () => void }) {
  const t = useTheme();
  const bounce = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(bounce, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 30, bounciness: 9 }).start();
  }, [focused, bounce]);
  const color = focused ? t.colors.ink : t.colors.inkFaint;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: focused }} accessibilityLabel={meta.label} onPress={onPress} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      <Animated.View style={{ transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }, { scale: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
        <Ionicons name={focused ? meta.filled : meta.outline} size={22} color={color} />
      </Animated.View>
      <Animated.Text numberOfLines={1} style={{ fontFamily: fonts.bodySemi, fontSize: 11, color }}>
        {meta.label}
      </Animated.Text>
      <Animated.View style={{ position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: t.colors.accent, opacity: bounce, transform: [{ scale: bounce }] }} />
    </Pressable>
  );
}
