export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function param(
  params: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = params[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first === '' ? undefined : first;
}

export function query(values: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : '';
}

export const SITE_URL = (process.env.WEB_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
