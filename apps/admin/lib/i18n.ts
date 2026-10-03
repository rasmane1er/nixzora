import 'server-only';
import {
  formatters,
  isLocale,
  type Locale,
  LOCALE_COOKIE,
  matchLocale,
  messagesFor,
  type Namespace,
  translator,
} from '@nixzora/i18n';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';

/**
 * The staff member's language: their choice (cookie, set by the language picker), else the
 * browser's Accept-Language, else English.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  try {
    return matchLocale((await headers()).get('accept-language'));
  } catch {
    return 'en';
  }
});

/** `const t = await getT('cart'); t('title')` in Server Components and actions. */
export async function getT<N extends Namespace>(namespace: N) {
  const locale = await getLocale();
  return translator(locale, messagesFor(locale))(namespace);
}

export async function getFormat() {
  return formatters(await getLocale());
}
