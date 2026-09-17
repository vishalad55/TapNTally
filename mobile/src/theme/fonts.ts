import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';

/** Never keep the user on a blank screen for type: after this the app renders with system fallbacks. */
const FONT_WAIT_MS = 2500;

/** Loads the brand fonts once at app start. Returns true when ready, on error, or after a short grace period. */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts({
    SpaceGrotesk_700Bold,
    SpaceGrotesk_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), FONT_WAIT_MS);
    return () => clearTimeout(id);
  }, []);
  return loaded || !!error || timedOut;
}
