import { INTL_LOCALE, type Locale } from './locale';

/** Locale-aware formatting. Amounts are cents; currency stays USD unless given. */
export function formatters(locale: Locale) {
  const tag = INTL_LOCALE[locale];
  return {
    money: (cents: number, currency = 'USD') =>
      new Intl.NumberFormat(tag, { style: 'currency', currency }).format(cents / 100),
    number: (value: number) => new Intl.NumberFormat(tag).format(value),
    percent: (fraction: number) =>
      new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 1 }).format(fraction),
    /** "Oct 3, 2026" / "3 oct. 2026" */
    date: (iso: string | Date) =>
      new Intl.DateTimeFormat(tag, { dateStyle: 'medium' }).format(new Date(iso)),
    /** "October 2026" */
    monthYear: (iso: string | Date) =>
      new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric' }).format(new Date(iso)),
    dateTime: (iso: string | Date) =>
      new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(iso),
      ),
    /** "Monday, October 5" */
    day: (iso: string | Date) =>
      new Intl.DateTimeFormat(tag, { weekday: 'long', month: 'long', day: 'numeric' }).format(
        new Date(iso),
      ),
  };
}
export type Formatters = ReturnType<typeof formatters>;
