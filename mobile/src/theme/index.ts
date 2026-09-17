import { useColorScheme } from 'react-native';

/**
 * Design tokens. One accent (mint green — "money in a good mood"), a warm
 * neutral scale, and semantic colours for budget states. Both schemes are
 * defined up front so every screen renders correctly in dark mode.
 */
const palette = {
  mint500: '#22C55E',
  mint600: '#16A34A',
  mint100: '#DCFCE7',
  amber500: '#F59E0B',
  red500: '#EF4444',
  slate950: '#0F172A',
  slate900: '#111827',
  slate800: '#1F2937',
  slate700: '#374151',
  slate500: '#6B7280',
  slate400: '#9CA3AF',
  slate300: '#D1D5DB',
  slate200: '#E5E7EB',
  slate100: '#F3F4F6',
  slate50: '#F9FAFB',
  white: '#FFFFFF',
};

export interface Theme {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceElevated: string;
    border: string;
    text: string;
    textMuted: string;
    textFaint: string;
    accent: string;
    accentStrong: string;
    accentSoft: string;
    warning: string;
    danger: string;
    success: string;
    onAccent: string;
  };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  spacing: (n: number) => number;
}

const base = {
  radius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
  spacing: (n: number) => n * 4,
};

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: palette.slate50,
    surface: palette.white,
    surfaceElevated: palette.white,
    border: palette.slate200,
    text: palette.slate900,
    textMuted: palette.slate500,
    textFaint: palette.slate400,
    accent: palette.mint500,
    accentStrong: palette.mint600,
    accentSoft: palette.mint100,
    warning: palette.amber500,
    danger: palette.red500,
    success: palette.mint600,
    onAccent: palette.white,
  },
  ...base,
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: palette.slate950,
    surface: palette.slate900,
    surfaceElevated: palette.slate800,
    border: palette.slate700,
    text: palette.slate50,
    textMuted: palette.slate400,
    textFaint: palette.slate500,
    accent: palette.mint500,
    accentStrong: palette.mint600,
    accentSoft: '#14532D',
    warning: palette.amber500,
    danger: palette.red500,
    success: palette.mint500,
    onAccent: palette.slate950,
  },
  ...base,
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

export const typography = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  mono: { fontVariant: ['tabular-nums'] as const },
};
