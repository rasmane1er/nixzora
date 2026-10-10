import { INTL_LOCALE, type Locale } from './locale';

/**
 * "Thu, Oct 15 – Tue, Oct 20", or one day when both ends match (p10-04). Takes the API's
 * calendar days ("2026-10-15"), so the shopper's own time zone never shifts the date.
 */
export function deliveryRange(
  window: { earliest: string; latest: string },
  locale: Locale,
): string {
  const format = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const day = (value: string) => format.format(new Date(`${value}T12:00:00Z`));
  return window.earliest === window.latest
    ? day(window.earliest)
    : `${day(window.earliest)} – ${day(window.latest)}`;
}
