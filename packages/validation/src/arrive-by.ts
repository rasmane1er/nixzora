import { deliveryWindow, OWN_HANDLING_DAYS } from './delivery';

/**
 * "Get it by" (p10-37): a search and listing filter that keeps only what arrives by a day, from
 * the same delivery dates the cards show (standard shipping; the latest day of the window). A
 * product qualifies when it's in stock, isn't a pre-order, its store isn't away and its store's
 * handling time gets it there in time.
 */
export const ARRIVE_BY_MAX_HANDLING_DAYS = 30;

/** The most handling days that still arrive by `day`, or -1 when nothing can. */
export function maxHandlingDaysBy(day: string, now = new Date()): number {
  let best = -1;
  for (let h = 0; h <= ARRIVE_BY_MAX_HANDLING_DAYS; h += 1) {
    if (deliveryWindow(now, h).latest > day) break;
    best = h;
  }
  return best;
}

/** The days offered as chips: the soonest NIXZORA delivers, and the next two after that. */
export function arriveByChoices(now = new Date()): string[] {
  const days: string[] = [];
  for (let h = OWN_HANDLING_DAYS; days.length < 3 && h <= ARRIVE_BY_MAX_HANDLING_DAYS; h += 1) {
    const latest = deliveryWindow(now, h).latest;
    if (!days.includes(latest)) days.push(latest);
  }
  return days;
}
