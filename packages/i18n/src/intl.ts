/**
 * Intl formatters are expensive to build (they load locale data) and cheap to reuse, so each
 * locale + options pair is built once per process. Profiling the storefront home page under load
 * showed a new NumberFormat per price and badge (docs/performance/load-test-report-2026-10.md).
 */
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

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

export function plurals(tag: string): Intl.PluralRules {
  let rules = pluralRules.get(tag);
  if (!rules) pluralRules.set(tag, (rules = new Intl.PluralRules(tag)));
  return rules;
}
