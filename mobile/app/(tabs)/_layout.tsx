import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { TapFlow } from '../../src/components/TapFlow';
import { useSession } from '../../src/store/session';
import { fonts, useTheme } from '../../src/theme';

const icon = (glyph: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{glyph}</Text>
);

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
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('🏠') }} />
        <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('🧾') }} />
        <Tabs.Screen name="tap-spacer" options={{ title: '', tabBarButton: () => null }} />
        <Tabs.Screen name="budgets" options={{ title: 'Budgets', tabBarIcon: icon('🎯') }} />
        <Tabs.Screen name="insights" options={{ title: 'Recap', tabBarIcon: icon('✨') }} />
        <Tabs.Screen name="family" options={{ title: 'Family', tabBarIcon: icon('👨‍👩‍👧') }} />
      </Tabs>
      <TapFlow />
    </>
  );
}
