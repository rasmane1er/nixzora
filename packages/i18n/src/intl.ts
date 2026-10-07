/**
 * Intl formatters are expensive to build (they load locale data) and cheap to reuse, so each
 * locale + options pair is built once per process. Profiling the storefront home page under load
 * showed a new NumberFormat per price and badge (docs/performance/load-test-report-2026-10.md).
 */
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const pluralRules = new Map<string, PluralRules>();

/** The part of Intl.PluralRules the translator uses. */
export type PluralRules = Pick<Intl.PluralRules, 'select'>;

export function numberFormat(
  tag: string,
  options: Intl.NumberFormatOptions = {},
): Intl.NumberFormat {
  const key = `${tag}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) numberFormats.set(key, (format = new Intl.NumberFormat(tag, options)));
  return format;
}

export function dateFormat(tag: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tag}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) dateFormats.set(key, (format = new Intl.DateTimeFormat(tag, options)));
  return format;
}

/**
 * CLDR cardinal rules for the languages we ship, for engines without Intl.PluralRules. Hermes
 * (the React Native engine on Android) has NumberFormat and DateTimeFormat but no PluralRules;
 * calling `new Intl.PluralRules` there crashed the app on its first translated plural.
 */
function fallbackPluralRules(tag: string): PluralRules {
  const language = tag.toLowerCase().split('-')[0];
  return {
    select(n: number): Intl.LDMLPluralRule {
      const i = Math.floor(Math.abs(n));
      if (language === 'fr') return i === 0 || i === 1 ? 'one' : 'other';
      return n === 1 ? 'one' : 'other';
    },
  };
}

export function plurals(tag: string): PluralRules {
  let rules = pluralRules.get(tag);
  if (!rules) {
    rules =
      typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function'
        ? new Intl.PluralRules(tag)
        : fallbackPluralRules(tag);
    pluralRules.set(tag, rules);
  }
  return rules;
}
