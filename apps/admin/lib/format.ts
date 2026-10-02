export function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

/** 129999 → "1299.99" for form inputs. */
export function centsInput(cents: number | null | undefined): string {
  return cents == null ? '' : (cents / 100).toFixed(2);
}

export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function pairsText(record: Record<string, unknown>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key} = ${String(value)}`)
    .join('\n');
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function param(
  params: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Builds "?a=1&b=2", skipping empty values. */
export function query(values: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : '';
}
