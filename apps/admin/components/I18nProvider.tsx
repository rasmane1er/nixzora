'use client';

import { type Locale, type Messages, type Namespace, translator } from '@nixzora/i18n';
import { createContext, useContext, useMemo } from 'react';

const I18nContext = createContext<{ locale: Locale; messages: Messages } | null>(null);

/** Gives client components the visitor's language (set once in the root layout). */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('I18nProvider is missing');
  return value;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/** `const t = useT('cart'); t('title')` */
export function useT<N extends Namespace>(namespace: N) {
  const { locale, messages } = useI18n();
  return useMemo(() => translator(locale, messages)(namespace), [locale, messages, namespace]);
}
