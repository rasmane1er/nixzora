import { z } from 'zod';
import { easternToday } from './preorders';

/**
 * Monthly budget (p10-35): a private spending cap a shopper sets for themselves. The cart and
 * checkout show what's left this month and warn before an order goes over it; nothing is ever
 * blocked. Months are US Eastern calendar months, like every date in the store.
 */
export const BUDGET_MIN_CENTS = 1_000;
export const BUDGET_MAX_CENTS = 10_000_000;

export const BudgetUpdateSchema = z.object({
  /** null turns the budget off. */
  monthlyCents: z.number().int().min(BUDGET_MIN_CENTS).max(BUDGET_MAX_CENTS).nullable(),
});
export type BudgetUpdate = z.infer<typeof BudgetUpdateSchema>;

export type BudgetView = {
  /** null when no budget is set. */
  monthlyCents: number | null;
  /** Paid this month, less refunds. */
  spentCents: number;
  /** What's left; negative once over. 0 with no budget. */
  leftCents: number;
  /** The Eastern month it covers ("2026-11"). */
  month: string;
};

/** The instant an Eastern calendar day ("2026-11-01") begins. */
export function easternDayStart(day: string): Date {
  // Eastern is UTC-4 (summer) or UTC-5 (winter): the right one is where the day starts.
  for (const hours of [4, 5]) {
    const at = new Date(`${day}T0${hours}:00:00Z`);
    if (easternToday(at) === day && easternToday(new Date(at.getTime() - 1)) !== day) return at;
  }
  return new Date(`${day}T05:00:00Z`);
}

/** When this Eastern month began, and its "YYYY-MM". */
export function easternMonth(now = new Date()): { month: string; start: Date } {
  const month = easternToday(now).slice(0, 7);
  return { month, start: easternDayStart(`${month}-01`) };
}

export type BudgetCheck =
  | { kind: 'none' }
  | { kind: 'within'; leftAfterCents: number }
  | { kind: 'over'; overCents: number };

/** What placing an order of `orderCents` does to the budget. */
export function budgetCheck(
  budget: BudgetView | null | undefined,
  orderCents: number,
): BudgetCheck {
  if (!budget?.monthlyCents) return { kind: 'none' };
  const leftAfterCents = budget.leftCents - orderCents;
  return leftAfterCents < 0
    ? { kind: 'over', overCents: -leftAfterCents }
    : { kind: 'within', leftAfterCents };
}
