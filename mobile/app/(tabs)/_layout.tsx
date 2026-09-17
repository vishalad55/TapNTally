import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';
import { TapFlow } from '../../src/components/TapFlow';
import { useSession } from '../../src/store/session';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const t = useTheme();
  const status = useSession((s) => s.status);
  if (status === 'signed_out') return <Redirect href="/(auth)/sign-in" />;

  return (
    <>
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.colors.bg } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="budgets" />
        <Tabs.Screen name="insights" />
        <Tabs.Screen name="family" />
      </Tabs>
      <TapFlow />
    </>
  );
}
