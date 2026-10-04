import { dateFormat, numberFormat } from './intl';
import { INTL_LOCALE, type Locale } from './locale';

/** Locale-aware formatting. Amounts are cents; currency stays USD unless given. */
export function formatters(locale: Locale) {
  const tag = INTL_LOCALE[locale];
  return {
    money: (cents: number, currency = 'USD') =>
      numberFormat(tag, { style: 'currency', currency }).format(cents / 100),
    number: (value: number) => numberFormat(tag).format(value),
    percent: (fraction: number) =>
      numberFormat(tag, { style: 'percent', maximumFractionDigits: 1 }).format(fraction),
    /** "Oct 3, 2026" / "3 oct. 2026" */
    date: (iso: string | Date) => dateFormat(tag, { dateStyle: 'medium' }).format(new Date(iso)),
    /** "October 2026" */
    monthYear: (iso: string | Date) =>
      dateFormat(tag, { month: 'long', year: 'numeric' }).format(new Date(iso)),
    dateTime: (iso: string | Date) =>
      dateFormat(tag, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)),
    /** "Monday, October 5" */
    day: (iso: string | Date) =>
      dateFormat(tag, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso)),
  };
}
export type Formatters = ReturnType<typeof formatters>;
