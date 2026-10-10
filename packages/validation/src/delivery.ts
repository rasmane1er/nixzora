/**
 * Delivery dates (p10-04): one rule for the product page, the cart, checkout and orders, on the
 * website, in the app and in the API.
 *
 * An order placed before the daily cutoff starts being prepared that business day; after it,
 * the next one. The seller's handling time (business days to hand it to the carrier) and the
 * carrier's standard transit time follow. Weekends and the fixed US holidays carriers close on
 * are skipped. Dates are calendar days in US Eastern time, as shoppers read them.
 */

/** Orders placed after 2 pm Eastern start the next business day. */
export const CUTOFF_HOUR_EASTERN = 14;
/** Standard ground transit inside the contiguous US, in business days. */
export const TRANSIT_DAYS = { min: 2, max: 5 } as const;
/** NIXZORA's own warehouse ships the next business day at the latest. */
export const OWN_HANDLING_DAYS = 1;

export type DeliveryWindow = {
  /** "2026-10-15" (Eastern), the earliest and latest expected delivery day. */
  earliest: string;
  latest: string;
};

/** "MM-DD" holidays carriers do not deliver on. */
const HOLIDAYS = new Set(['01-01', '07-04', '12-25']);

/** The calendar date and hour in US Eastern time. */
function eastern(at: Date): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

function addDays(day: string, n: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

export function isBusinessDay(day: string): boolean {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !HOLIDAYS.has(day.slice(5));
}

/** The business day `n` business days after `day` (0: `day` itself, or the next business day). */
export function addBusinessDays(day: string, n: number): string {
  let current = day;
  while (!isBusinessDay(current)) current = addDays(current, 1);
  for (let left = n; left > 0; ) {
    current = addDays(current, 1);
    if (isBusinessDay(current)) left--;
  }
  return current;
}

/** When an order placed `at` should arrive, given the slowest handling time in it. */
export function deliveryWindow(at: Date, handlingDays: number): DeliveryWindow {
  const { day, hour } = eastern(at);
  const start = hour >= CUTOFF_HOUR_EASTERN || !isBusinessDay(day) ? addDays(day, 1) : day;
  const shipped = addBusinessDays(start, Math.max(0, handlingDays));
  return {
    earliest: addBusinessDays(shipped, TRANSIT_DAYS.min),
    latest: addBusinessDays(shipped, TRANSIT_DAYS.max),
  };
}

/** After shipping: transit only, counted from the ship date. */
export function deliveryWindowFromShipment(shippedAt: Date): DeliveryWindow {
  const { day } = eastern(shippedAt);
  return {
    earliest: addBusinessDays(day, TRANSIT_DAYS.min),
    latest: addBusinessDays(day, TRANSIT_DAYS.max),
  };
}
