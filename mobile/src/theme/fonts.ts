import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';

/** Loads the brand fonts once at app start. Returns true when ready (or on error, so the app never blocks). */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts({
    SpaceGrotesk_700Bold,
    SpaceGrotesk_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  return loaded || !!error;
}
