import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { useThemeSetting } from '@/lib/prefs';

export type Theme = {
  id: string;
  name: string;
  dark: boolean;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  /** Errors and failures; not a preset token, picked for contrast on light or dark. */
  danger: string;
};

/** Tokens in order: bg surface border text muted accent onAccent. */
const preset = (name: string, tokens: string, dark = false): Theme => {
  const [bg, surface, border, text, muted, accent, onAccent] = tokens.split(' ');
  return {
    id: name.toLowerCase(),
    name,
    dark,
    bg,
    surface,
    border,
    text,
    muted,
    accent,
    onAccent,
    danger: dark ? '#FF8FA3' : '#B42318',
  };
};

/** The first is the default. */
export const THEMES: readonly Theme[] = [
  preset('Paper', '#FAFAF7 #FFFFFF #E2E0DA #1F2328 #5F636A #2F6FDE #FFFFFF'),
  preset('Sepia', '#F4ECDD #FBF6EC #E1D2B8 #3B2F22 #6B5B46 #A4552A #FFFFFF'),
  preset('Mist', '#EDF1F5 #FFFFFF #D6DEE7 #1E2A38 #56636F #3A6EA5 #FFFFFF'),
  preset('Sage', '#EDF2EA #FAFCF8 #D5DFCF #22301F #56644F #4C7A36 #FFFFFF'),
  preset('Linen', '#F7F4EF #FFFDF9 #E6E0D6 #2B2722 #625B52 #7A5C3E #FFFFFF'),
  preset('Sky', '#EAF4FB #FFFFFF #CFE3F1 #16324A #4B6378 #1F78B4 #FFFFFF'),
  preset('Mint', '#E8F6F1 #FFFFFF #CBE8DD #163A30 #4A6A60 #1F8268 #FFFFFF'),
  preset('Lavender', '#F2EFFA #FFFFFF #DDD7F0 #2A2340 #5D5675 #6A4FB8 #FFFFFF'),
  preset('Butter', '#FCF7E3 #FFFDF4 #EDE3BE #3A3218 #6A5F3C #946B00 #FFFFFF'),
  preset('Stone', '#F1F1F0 #FFFFFF #DCDCDA #202020 #5C5C5A #3C3C3C #FFFFFF'),
  preset('Anthracite', '#2F3236 #3B3F44 #4B5056 #EEEFF0 #B6BAC0 #93B6FF #1C2230', true),
  preset('Navy', '#1D3557 #27426A #36557F #F1FAEE #A8B8CC #F1FAEE #1D3557', true),
];

/** The active theme, its setter, and whether the saved choice has loaded yet. */
export function useThemeChoice() {
  const [id, set, loaded] = useThemeSetting();
  const theme = THEMES.find(t => t.id === id) ?? THEMES[0];
  return { theme, set: (next: Theme) => set(next.id), loaded };
}

export const useTheme = () => useThemeChoice().theme;

type Styles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/** Turns a theme-dependent style sheet into a hook. */
export function makeStyles<S extends Styles>(build: (theme: Theme) => S & Styles) {
  return () => {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(build(theme)), [theme]);
  };
}
