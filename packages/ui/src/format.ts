/** 129999, "USD" → "$1,299.99". All money in NIXZORA is integer cents. */
export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
