import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiClientError } from '../src/api/client';
import { useSession } from '../src/store/session';
import { useAppearance, useTheme } from '../src/theme';
import { useBrandFonts } from '../src/theme/fonts';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count: number, err: unknown) => !(err instanceof ApiClientError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

export default function RootLayout() {
  const t = useTheme();
  const status = useSession((s) => s.status);
  const boot = useSession((s) => s.boot);
  const hydrateAppearance = useAppearance((s) => s.hydrate);
  const fontsReady = useBrandFonts();

  useEffect(() => {
    void boot();
    void hydrateAppearance();
  }, [boot, hydrateAppearance]);

  useEffect(() => {
    if (status !== 'booting' && fontsReady) void SplashScreen.hideAsync();
  }, [status, fontsReady]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={t.dark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: t.colors.bg },
              headerTintColor: t.colors.ink,
              headerTitleStyle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18 },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: t.colors.bg },
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="transaction/[id]" options={{ title: 'Purchase' }} />
            <Stack.Screen name="add-transaction" options={{ title: 'Add a purchase', presentation: 'modal' }} />
            <Stack.Screen name="budget-edit" options={{ title: 'Set a budget', presentation: 'modal' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="connections" options={{ title: 'Connections' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
