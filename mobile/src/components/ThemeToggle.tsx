import { useAppearance, useTheme } from '../theme';
import { IconButton } from './ui';

/** Sun/moon button that flips between the Paper and Arcade moods. */
export function ThemeToggle() {
  const t = useTheme();
  const setMode = useAppearance((s) => s.setMode);
  return (
    <IconButton
      name={t.dark ? 'sunny-outline' : 'moon-outline'}
      label={t.dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onPress={() => setMode(t.dark ? 'light' : 'dark')}
    />
  );
}
