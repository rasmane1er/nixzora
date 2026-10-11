import { z } from 'zod';
import { addDays } from './delivery';
import { easternToday } from './preorders';

/**
 * Warranty tracker (p10-33): a listing says how long its warranty lasts; each order line keeps
 * that length from the day of purchase, and the warranty runs from delivery (or from purchase
 * until it's delivered). Shoppers see their warranties in one place and get a reminder before
 * one ends. Return reminders (p10-34) use the same reminders sweep.
 */
export const WARRANTY_MAX_MONTHS = 120;
/** A reminder this many days before a warranty ends. */
export const WARRANTY_REMIND_DAYS = 21;
/** And this many days before a return window closes. */
export const RETURN_REMIND_DAYS = 2;
/** The choices offered in listing editors (any whole number up to the maximum is accepted). */
export const WARRANTY_CHOICES = [3, 6, 12, 24, 36, 60] as const;

export const WarrantyMonthsSchema = z.number().int().min(1).max(WARRANTY_MAX_MONTHS).nullable();

/** The last day of cover: `months` calendar months after `start` ("2026-10-20"), less a day. */
export function warrantyUntil(start: string, months: number): string {
  const [y, m, d] = start.split('-').map(Number) as [number, number, number];
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = total % 12;
  // Clamp to the month's last day (Jan 31 + 1 month = Feb 28).
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(year, month, Math.min(d, last)));
  return addDays(end.toISOString().slice(0, 10), -1);
}

export type WarrantyStatus = 'ACTIVE' | 'ENDING_SOON' | 'ENDED';

export function warrantyStatus(until: string, now = new Date()): WarrantyStatus {
  const today = easternToday(now);
  if (until < today) return 'ENDED';
  if (until <= addDays(today, WARRANTY_REMIND_DAYS)) return 'ENDING_SOON';
  return 'ACTIVE';
}

/** "2-year warranty", "6-month warranty": years when it's a whole number of them. */
export function warrantyParts(months: number): { years: number } | { months: number } {
  return months % 12 === 0 ? { years: months / 12 } : { months };
}

export type WarrantyView = {
  orderItemId: string;
  orderNumber: string;
  productTitle: string;
  variantTitle: string;
  productSlug: string | null;
  imageUrl: string | null;
  /** The store that sold it; null is NIXZORA. */
  seller: { handle: string; displayName: string } | null;
  months: number;
  /** When cover started (delivery, or purchase until delivered). */
  from: string;
  until: string;
  status: WarrantyStatus;
};
