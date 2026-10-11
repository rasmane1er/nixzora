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

/** Today's calendar date in US Eastern time ("2026-10-10"), as delivery dates are written. */
function easternToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * One delivery day for a product card (p10-17): "Oct 11" with whether it is tomorrow (shown as
 * "Tomorrow, Oct 11"), else "Tue, Oct 14".
 */
export function deliveryDay(
  day: string,
  locale: Locale,
  now = new Date(),
): { tomorrow: boolean; text: string } {
  const at = new Date(`${day}T12:00:00Z`);
  const today = new Date(`${easternToday(now)}T12:00:00Z`);
  const tomorrow = Math.round((at.getTime() - today.getTime()) / 86_400_000) === 1;
  const text = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    ...(tomorrow ? {} : { weekday: 'short' as const }),
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(at);
  return { tomorrow, text };
}

/** One calendar day from the API ("2026-11-20") as "Fri, Nov 20", in any time zone. */
export function calendarDay(day: string, locale: Locale): string {
  return deliveryRange({ earliest: day, latest: day }, locale);
}
