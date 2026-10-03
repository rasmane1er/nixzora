export const LOCALES = ['en', 'fr', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Each language in its own words, for pickers. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
};

/** BCP 47 tags for Intl formatting. Prices stay in US dollars in every language. */
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-US', fr: 'fr-FR', es: 'es-US' };

/** Cookie (web) and storage key (app) that hold the visitor's choice. */
export const LOCALE_COOKIE = 'nx_lang';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * The best supported language for an Accept-Language header or a device locale list
 * ("fr-CA,fr;q=0.9,en;q=0.8" → "fr"). English when nothing matches.
 */
export function matchLocale(preferences: string | readonly string[] | null | undefined): Locale {
  const list =
    typeof preferences === 'string'
      ? preferences
          .split(',')
          .map((part) => {
            const [tag, ...params] = part.trim().split(';');
            const q = params.find((p) => p.trim().startsWith('q='));
            return { tag: tag?.trim() ?? '', q: q ? Number(q.trim().slice(2)) : 1 };
          })
          .filter((p) => p.tag && p.q > 0)
          .sort((a, b) => b.q - a.q)
          .map((p) => p.tag)
      : (preferences ?? []);
  for (const tag of list) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
