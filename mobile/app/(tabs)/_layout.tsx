import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { TapFlow } from '../../src/components/TapFlow';
import { useSession } from '../../src/store/session';
import { fonts, useTheme } from '../../src/theme';
import type { IoniconName } from '../../src/theme/icons';

const icon = (outline: IoniconName, filled: IoniconName) =>
  function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Ionicons name={focused ? filled : outline} size={22} color={color as string} />;
  };

export default function TabsLayout() {
  const t = useTheme();
  const status = useSession((s) => s.status);
  if (status === 'signed_out') return <Redirect href="/(auth)/sign-in" />;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.colors.ink,
          tabBarInactiveTintColor: t.colors.inkFaint,
          tabBarStyle: {
            backgroundColor: t.colors.surface,
            borderTopColor: t.colors.border,
            borderTopWidth: t.cardBorderWidth,
            height: 64,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
          sceneStyle: { backgroundColor: t.colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
        <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('receipt-outline', 'receipt') }} />
        <Tabs.Screen name="tap-spacer" options={{ title: '', tabBarButton: () => null }} />
        <Tabs.Screen name="budgets" options={{ title: 'Budgets', tabBarIcon: icon('pie-chart-outline', 'pie-chart') }} />
        <Tabs.Screen name="insights" options={{ title: 'Recap', tabBarIcon: icon('sparkles-outline', 'sparkles') }} />
        <Tabs.Screen name="family" options={{ title: 'Family', tabBarIcon: icon('people-outline', 'people') }} />
      </Tabs>
      <TapFlow />
    </>
  );
}
