import { addDays, deliveryWindow, type DeliveryWindow, eastern, twoDayWindow } from './delivery';

/**
 * Pre-orders (p10-30): a product with a release date in the future sells now and ships from
 * that day. The stock a store lists is what it can pre-sell, so holds, checkout and payment work
 * as for any product. Calendar days are US Eastern, like every delivery date.
 */
export const PREORDER_MAX_DAYS = 180;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today, US Eastern ("2026-11-03"). */
export function easternToday(now = new Date()): string {
  return eastern(now).day;
}

/** A pre-order until its release day; on that day it's an ordinary product again. */
export function isPreorder(releaseDate: string | null | undefined, now = new Date()): boolean {
  return !!releaseDate && DAY.test(releaseDate) && releaseDate > easternToday(now);
}

/** Midday Eastern on the release day: before the shipping cutoff, so it can ship that day. */
export function releaseStart(releaseDate: string): Date {
  return new Date(`${releaseDate}T17:00:00Z`);
}

/** Why a release date can't be used, or null: it must be after today and within 180 days. */
export function releaseDateProblem(
  releaseDate: string,
  now = new Date(),
): 'INVALID' | 'NOT_FUTURE' | 'TOO_FAR' | null {
  if (!DAY.test(releaseDate) || Number.isNaN(Date.parse(releaseDate))) return 'INVALID';
  const today = easternToday(now);
  if (releaseDate <= today) return 'NOT_FUTURE';
  if (releaseDate > addDays(today, PREORDER_MAX_DAYS)) return 'TOO_FAR';
  return null;
}

/** When an order placed now arrives: from today, or from the release day for a pre-order. */
export function deliveryFrom(
  handlingDays: number,
  releaseDate: string | null | undefined,
  now = new Date(),
): DeliveryWindow {
  return isPreorder(releaseDate, now)
    ? deliveryWindow(releaseStart(releaseDate!), handlingDays)
    : deliveryWindow(now, handlingDays);
}

/** NIXZORA Plus 2-day (p10-15), from the release day for a pre-order. */
export function twoDayFrom(
  releaseDate: string | null | undefined,
  now = new Date(),
): DeliveryWindow {
  return isPreorder(releaseDate, now)
    ? twoDayWindow(releaseStart(releaseDate!))
    : twoDayWindow(now);
}

/**
 * The delivery promise a card or product page shows: Plus members get NIXZORA's own items in
 * 2 days (from release, for a pre-order); everyone else gets the API's window.
 */
export function shownDelivery(
  product: {
    delivery?: DeliveryWindow | null;
    preorder?: { releaseDate: string } | null;
    shipsFromNixzora?: boolean;
  },
  twoDay: boolean,
  now = new Date(),
): DeliveryWindow | null {
  if (twoDay) return twoDayFrom(product.preorder?.releaseDate, now);
  return product.delivery ?? null;
}

export const RELEASE_DATE_PROBLEM_TEXT: Record<'INVALID' | 'NOT_FUTURE' | 'TOO_FAR', string> = {
  INVALID: 'Enter the release date as a date.',
  NOT_FUTURE: 'The release date has to be after today.',
  TOO_FAR: `The release date can be up to ${PREORDER_MAX_DAYS} days from today.`,
};
