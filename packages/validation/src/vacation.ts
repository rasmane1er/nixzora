import { z } from 'zod';
import { addDays } from './delivery';
import { easternToday } from './preorders';

/**
 * Store vacation mode (p10-32): a store that's away can't take orders. Its listings stay
 * visible (with when it's back) but can't be bought, so shoppers don't pay for something that
 * sits for weeks. Calendar days are US Eastern; `until` is the day it takes orders again.
 */
export const VACATION_MAX_DAYS = 90;
export const VACATION_MESSAGE_MAX = 300;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const VacationSchema = z.object({
  /** First day away; today or later. */
  from: z.string().regex(DAY),
  /** The day it's back; none = until the store turns it off. */
  until: z.string().regex(DAY).nullable().optional(),
  /** Shown to shoppers on the store's pages. */
  message: z.string().trim().max(VACATION_MESSAGE_MAX).nullable().optional(),
});
export type VacationInput = z.infer<typeof VacationSchema>;

/** A store's vacation as stored (days, or null). */
export type Vacation = { from: string | null; until: string | null; message: string | null };

/** What shoppers see while a store is away. */
export const StoreAwaySchema = z.object({
  until: z.string().nullable(),
  message: z.string().nullable(),
});
export type StoreAway = z.infer<typeof StoreAwaySchema>;

/** Away today: from its first day until (not including) the day it's back. */
export function storeAway(
  vacation: Vacation | null | undefined,
  now = new Date(),
): StoreAway | null {
  if (!vacation?.from) return null;
  const today = easternToday(now);
  if (today < vacation.from) return null;
  if (vacation.until && today >= vacation.until) return null;
  return { until: vacation.until, message: vacation.message };
}

/** Why these dates can't be used, or null. */
export function vacationProblem(
  input: { from: string; until?: string | null },
  now = new Date(),
): 'INVALID' | 'PAST' | 'START_TOO_FAR' | 'ENDS_BEFORE' | 'TOO_LONG' | null {
  const valid = (d: string) => DAY.test(d) && !Number.isNaN(Date.parse(d));
  if (!valid(input.from) || (input.until && !valid(input.until))) return 'INVALID';
  const today = easternToday(now);
  if (input.from < today) return 'PAST';
  if (input.from > addDays(today, VACATION_MAX_DAYS)) return 'START_TOO_FAR';
  if (input.until && input.until <= input.from) return 'ENDS_BEFORE';
  if (input.until && input.until > addDays(input.from, VACATION_MAX_DAYS)) return 'TOO_LONG';
  return null;
}
