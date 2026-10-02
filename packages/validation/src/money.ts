import { z } from 'zod';

/** ISO 4217 currency codes NIXZORA accepts today. */
export const CurrencySchema = z.enum(['USD']);

/**
 * Money is always an integer number of minor units (cents) plus a currency.
 * Never use floating point for prices.
 */
export const MoneySchema = z.object({
  amountCents: z.number().int(),
  currency: CurrencySchema,
});

export type Currency = z.infer<typeof CurrencySchema>;
export type Money = z.infer<typeof MoneySchema>;

export function formatMoney({ amountCents, currency }: Money, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountCents / 100);
}
