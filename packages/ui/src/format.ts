/** 129999, "USD" → "$1,299.99". All money in NIXZORA is integer cents. `locale` is a BCP 47 tag. */
export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}
