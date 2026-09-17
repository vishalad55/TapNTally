import { Pressable, Text } from 'react-native';
import { useAppearance, useTheme } from '../theme';

/** Sun/moon pill that flips between the Paper and Arcade moods. */
export function ThemeToggle() {
  const t = useTheme();
  const setMode = useAppearance((s) => s.setMode);
  return (
    <Pressable
      accessibilityLabel={t.dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onPress={() => setMode(t.dark ? 'light' : 'dark')}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: t.colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 18 }}>{t.dark ? '☀️' : '🌙'}</Text>
    </Pressable>
  );
}
