const currencyFormats = new Map<string, Intl.NumberFormat>();

/** 129999, "USD" → "$1,299.99". All money in NIXZORA is integer cents. `locale` is a BCP 47 tag. */
export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  // Built once per locale and currency: a new Intl.NumberFormat per price is costly under load.
  const key = `${locale}|${currency}`;
  let format = currencyFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: 'currency', currency });
    currencyFormats.set(key, format);
  }
  return format.format(cents / 100);
}
