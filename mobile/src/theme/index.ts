import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';

/**
 * Design tokens — see docs/DESIGN.md (the source of truth, mirrored in Figma).
 *
 * Light ("Paper") and dark ("Arcade") are two different colour worlds on
 * purpose: warm paper + coral by day, navy + electric lime by night.
 */
export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  /** Second voice: recap highlights, "shared" stickers. Same as accent in light. */
  pop: string;
  money: string;
  warn: string;
  danger: string;
  /** Translucent scrim behind sheets. */
  scrim: string;
}

export interface Theme {
  name: 'paper' | 'arcade';
  dark: boolean;
  colors: ThemeColors;
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  /** Cards get a hairline in light mode only; dark relies on surface contrast. */
  cardBorderWidth: number;
  spacing: (n: number) => number;
}

const base = {
  radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  spacing: (n: number) => n * 4,
};

export const paperTheme: Theme = {
  name: 'paper',
  dark: false,
  cardBorderWidth: 1,
  colors: {
    bg: '#F6F2EA',
    surface: '#FFFFFF',
    surfaceAlt: '#EFE9DE',
    border: '#E3DCCF',
    ink: '#15130F',
    inkMuted: '#6B6558',
    inkFaint: '#A39C8D',
    accent: '#FF5A36',
    accentInk: '#FFFFFF',
    accentSoft: '#FFE3DB',
    pop: '#FF5A36',
    money: '#0E9F6E',
    warn: '#F5B400',
    danger: '#E2453C',
    scrim: 'rgba(21,19,15,0.55)',
  },
  ...base,
};

export const arcadeTheme: Theme = {
  name: 'arcade',
  dark: true,
  cardBorderWidth: 0,
  colors: {
    bg: '#0B0E15',
    surface: '#151A26',
    surfaceAlt: '#1E2533',
    border: '#2A3242',
    ink: '#F4F6FB',
    inkMuted: '#9AA3B5',
    inkFaint: '#5F6779',
    accent: '#C8FF3D',
    accentInk: '#0B0E15',
    accentSoft: '#2A3A14',
    pop: '#FF4FA3',
    money: '#4ADE80',
    warn: '#FBBF24',
    danger: '#F87171',
    scrim: 'rgba(3,5,10,0.7)',
  },
  ...base,
};

// ---- appearance preference -------------------------------------------------

export type AppearanceMode = 'system' | 'light' | 'dark';
const APPEARANCE_KEY = 'tapntally.appearance';

interface AppearanceState {
  mode: AppearanceMode;
  hydrated: boolean;
  setMode: (m: AppearanceMode) => void;
  hydrate: () => Promise<void>;
}

export const useAppearance = create<AppearanceState>((set) => ({
  mode: 'system',
  hydrated: false,
  setMode: (mode) => {
    set({ mode });
    void AsyncStorage.setItem(APPEARANCE_KEY, mode);
  },
  hydrate: async () => {
    try {
      const raw = (await AsyncStorage.getItem(APPEARANCE_KEY)) as AppearanceMode | null;
      if (raw === 'light' || raw === 'dark' || raw === 'system') set({ mode: raw });
    } finally {
      set({ hydrated: true });
    }
  },
}));

export function useTheme(): Theme {
  const system = useColorScheme();
  const mode = useAppearance((s) => s.mode);
  const dark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return dark ? arcadeTheme : paperTheme;
}

// ---- type ------------------------------------------------------------------

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;

export const typography = {
  hero: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  money: { fontFamily: fonts.displayMedium, fontSize: 17, lineHeight: 22, fontVariant: ['tabular-nums'] as const },
  heading: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' as const },
} as const;

export type TypographyVariant = keyof typeof typography;
