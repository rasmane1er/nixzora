import { useColorScheme } from 'react-native';

/** NIXZORA brand tokens (same values as packages/ui/src/tokens.css). */
export const brand = {
  ink: '#0E1726',
  paper: '#F6F5F1',
  signal: '#E8622C',
  /** Fills behind white text (primary buttons): 4.8:1 with white, WCAG AA. */
  signalStrong: '#C24D1B',
  signalPressed: '#A9431A',
  ai: '#17706B',
} as const;

type PaletteShape = Record<
  | 'bg'
  | 'fg'
  | 'card'
  | 'line'
  | 'muted'
  | 'input'
  | 'signalText'
  | 'ai'
  | 'okBg'
  | 'okFg'
  | 'errBg'
  | 'errFg'
  | 'warnBg'
  | 'warnFg'
  | 'tile'
  | 'tileFg',
  string
>;

const light: PaletteShape = {
  bg: brand.paper,
  fg: brand.ink,
  card: '#FDFCFA',
  line: '#E2DFD6',
  muted: '#5F6673',
  input: '#FFFFFF',
  signalText: '#B8461A',
  ai: brand.ai,
  okBg: '#E4F1E9',
  okFg: '#2B6A47',
  errBg: '#FBE7DF',
  errFg: '#9C3412',
  warnBg: '#FDF0D8',
  warnFg: '#8A5A0F',
  tile: brand.ink,
  tileFg: brand.paper,
};

export type Palette = PaletteShape;

const dark: Palette = {
  bg: '#0B111B',
  fg: '#E7EBF1',
  card: '#131B28',
  line: '#263244',
  muted: '#9BA6B6',
  input: '#0F1622',
  signalText: '#F08A5D',
  ai: '#4FB8AF',
  okBg: '#12301F',
  okFg: '#7FD4A2',
  errBg: '#3A1A10',
  errFg: '#F5A585',
  warnBg: '#33270F',
  warnFg: '#E3B455',
  tile: brand.paper,
  tileFg: brand.ink,
};

export const palettes = { light, dark };

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Loaded in the root layout with expo-font. */
export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_600SemiBold',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodyBold: 'IBMPlexSans_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = 12;
