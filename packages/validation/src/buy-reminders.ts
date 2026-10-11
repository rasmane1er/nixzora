import { z } from 'zod';
import { type ProductCard } from './catalog';
import { easternDayStart } from './budget';
import { addDays } from './delivery';
import { easternToday } from './preorders';

/**
 * "Remind me to buy" (p10-36): on a product page, ask to be reminded on a day that suits you
 * (Friday, payday or a date you pick). That morning we send a push and an email with today's
 * price, and say so if it dropped since you asked. One reminder per product.
 */
export const BUY_REMINDER_MAX_DAYS = 90;
/** Reminders go out from this hour, US Eastern. */
export const BUY_REMINDER_HOUR = 9;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const BuyReminderSetSchema = z.object({
  /** The day to be reminded ("2026-10-16"), after today and up to 90 days ahead. */
  date: z.string().regex(DAY),
});
export type BuyReminderSet = z.infer<typeof BuyReminderSetSchema>;

/** Why a date can't be used, in English for the API; null when it's fine. */
export function buyReminderProblem(date: string, now = new Date()): string | null {
  const today = easternToday(now);
  if (!DAY.test(date) || date <= today) return 'Pick a day after today.';
  if (date > addDays(today, BUY_REMINDER_MAX_DAYS))
    return `Pick a day within ${BUY_REMINDER_MAX_DAYS} days.`;
  return null;
}

/** 9:00 Eastern on the day. */
export function buyReminderAt(date: string): Date {
  return new Date(easternDayStart(date).getTime() + BUY_REMINDER_HOUR * 3_600_000);
}

export type BuyReminderChoice = { key: 'tomorrow' | 'friday' | 'payday'; date: string };

/**
 * The quick choices: tomorrow, the coming Friday (a week on, if today is Thursday or Friday) and
 * the next payday (the 1st or the 15th), soonest first. Duplicates are dropped.
 */
export function buyReminderChoices(now = new Date()): BuyReminderChoice[] {
  const today = easternToday(now);
  const tomorrow = addDays(today, 1);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  let friday = addDays(today, (5 - weekday + 7) % 7);
  if (friday <= tomorrow) friday = addDays(friday, 7);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const payday =
    d < 15 ? `${today.slice(0, 8)}15` : new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const out: BuyReminderChoice[] = [{ key: 'tomorrow', date: tomorrow }];
  if (friday !== tomorrow) out.push({ key: 'friday', date: friday });
  if (!out.some((c) => c.date === payday)) out.push({ key: 'payday', date: payday });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export type BuyReminderView = {
  productId: string;
  date: string;
  /** The price when the reminder was set. */
  priceCents: number;
  createdAt: string;
  /** The product as it is now; null once it's no longer on sale. In lists only. */
  product?: ProductCard | null;
};
