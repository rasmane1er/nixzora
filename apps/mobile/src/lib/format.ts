import { INTL_LOCALE, type Locale, messagesFor } from '@nixzora/i18n';
import { useMemo } from 'react';
import { language, useLocale } from './i18n';

/*
 * Every helper takes an optional locale and defaults to the app's current language. Components
 * should prefer `useFormatters()`, which re-renders them when the language changes.
 */

const numberFormats = new Map<string, Intl.NumberFormat>();

function currencyFormat(locale: Locale, currency: string, whole: boolean): Intl.NumberFormat {
  const id = `${locale}:${currency}:${whole}`;
  let formatter = numberFormats.get(id);
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: 'currency',
      currency,
      ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    });
    numberFormats.set(id, formatter);
  }
  return formatter;
}

/** 134900, "USD" → "$1,349.00" (fr: "1 349,00 $US") */
export function money(cents: number, currency = 'USD', locale: Locale = language.get()): string {
  return currencyFormat(locale, currency, false).format(cents / 100);
}

/** Round budgets without cents: 150000 → "$1,500"; 149950 → "$1,499.50". */
export function wholeMoney(
  cents: number,
  currency = 'USD',
  locale: Locale = language.get(),
): string {
  return currencyFormat(locale, currency, cents % 100 === 0).format(cents / 100);
}

/** 0.09 → "9%" (fr: "9 %"); for sale badges. */
export function percent(fraction: number, locale: Locale = language.get()): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(fraction);
}

/** "Oct 3, 2026" */
export function shortDate(iso: string, locale: Locale = language.get()): string {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "Oct 3, 9:05 AM" */
export function dateTime(iso: string, locale: Locale = language.get()): string {
  return new Date(iso).toLocaleString(INTL_LOCALE[locale], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** A rating such as 4.25 → "4.3" (fr: "4,3"). */
export function rating(value: number, locale: Locale = language.get()): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function statusLabel(status: string, locale: Locale = language.get()): string {
  const labels = messagesFor(locale).appShop as Record<string, string>;
  return labels[`status_${status}`] ?? status;
}

/** Variant options as one line: "32GB · Graphite". */
export function optionsText(options: Record<string, string>): string {
  return Object.values(options).join(' · ');
}

/** A department's name in the customer's language, by slug; others as stored. */
export function departmentName(
  slug: string,
  name: string,
  locale: Locale = language.get(),
): string {
  const names = messagesFor(locale).departments as Record<string, string>;
  return names[slug] ?? name;
}

const UNITS: Record<string, string> = {
  in: 'in',
  hz: 'Hz',
  gb: 'GB',
  tb: 'TB',
  kg: 'kg',
  g: 'g',
  w: 'W',
  mah: 'mAh',
  hours: 'hours',
  mm: 'mm',
};

/**
 * "refresh_hz" → "Refresh (Hz)", "battery_hours" → "Battery (hours)", "cpu_cores" → "Cpu cores".
 * In French and Spanish, known attributes use the product page's translated spec names.
 */
export function attributeLabel(key: string, locale: Locale = language.get()): string {
  if (locale !== 'en') {
    const specs = messagesFor(locale).productPage as Record<string, string>;
    const known = specs[`spec_${key}`];
    if (known) return known;
  }
  const parts = key.split('_');
  const unit = parts.length > 1 ? UNITS[parts.at(-1)!] : undefined;
  const words = (unit ? parts.slice(0, -1) : parts).join(' ');
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return unit ? `${label} (${unit})` : label;
}

/** The helpers above in the current language; re-renders when the language changes. */
export function useFormatters() {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale,
      money: (cents: number, currency = 'USD') => money(cents, currency, locale),
      wholeMoney: (cents: number, currency = 'USD') => wholeMoney(cents, currency, locale),
      shortDate: (iso: string) => shortDate(iso, locale),
      dateTime: (iso: string) => dateTime(iso, locale),
      rating: (value: number) => rating(value, locale),
      percent: (fraction: number) => percent(fraction, locale),
      statusLabel: (status: string) => statusLabel(status, locale),
      optionsText,
      departmentName: (slug: string, name: string) => departmentName(slug, name, locale),
      attributeLabel: (key: string) => attributeLabel(key, locale),
    }),
    [locale],
  );
}
