import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'nixzora.theme';

/** Applies the saved appearance at start-up (Settings → Appearance). */
export async function applySavedTheme(): Promise<ThemeChoice> {
  const saved = ((await AsyncStorage.getItem(KEY).catch(() => null)) ?? 'system') as ThemeChoice;
  apply(saved);
  return saved;
}

export async function setTheme(choice: ThemeChoice): Promise<void> {
  apply(choice);
  await AsyncStorage.setItem(KEY, choice).catch(() => undefined);
}

function apply(choice: ThemeChoice): void {
  // Not in react-native-web: the browser's own setting applies there.
  if (typeof Appearance.setColorScheme !== 'function') return;
  // "unspecified" hands control back to the system setting.
  Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
}
