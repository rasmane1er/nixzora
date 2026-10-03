import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  formatters,
  isLocale,
  type Locale,
  matchLocale,
  messagesFor,
  type Namespace,
  translator,
} from '@nixzora/i18n';
import { useMemo, useSyncExternalStore } from 'react';

const KEY = 'nixzora.language';

/** The phone's own language list (Hermes Intl), e.g. "fr-CA" → "fr". */
function deviceLocale(): Locale {
  try {
    return matchLocale([Intl.DateTimeFormat().resolvedOptions().locale]);
  } catch {
    return 'en';
  }
}

let locale: Locale = deviceLocale();
/** True once the customer picked a language (in Settings), not just the phone's default. */
let chosen = false;
const listeners = new Set<() => void>();

function set(next: Locale, explicit: boolean) {
  chosen = chosen || explicit;
  if (next === locale) return;
  locale = next;
  for (const listener of listeners) listener();
}

export const language = {
  get: () => locale,
  isChosen: () => chosen,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** At start-up: the saved choice, else the phone's language. */
  async load(): Promise<void> {
    const saved = await AsyncStorage.getItem(KEY).catch(() => null);
    if (isLocale(saved)) set(saved, true);
  },
  /** From Settings: saved on the phone (and on the account by the caller when signed in). */
  async choose(next: Locale): Promise<void> {
    set(next, true);
    await AsyncStorage.setItem(KEY, next).catch(() => undefined);
  },
  /** At sign-in: the account's language, unless the customer chose one on this phone. */
  adopt(next: string): void {
    if (!chosen && isLocale(next)) set(next, false);
  },
};

export function useLocale(): Locale {
  return useSyncExternalStore(language.subscribe, language.get, language.get);
}

/** `const t = useT('appShop'); t('title')` — re-renders when the language changes. */
export function useT<N extends Namespace>(namespace: N) {
  const current = useLocale();
  return useMemo(() => translator(current, messagesFor(current))(namespace), [current, namespace]);
}

export function useFormat() {
  const current = useLocale();
  return useMemo(() => formatters(current), [current]);
}

/** Outside React (alerts, notifications): the current language's translator. */
export function t<N extends Namespace>(namespace: N) {
  return translator(locale, messagesFor(locale))(namespace);
}
