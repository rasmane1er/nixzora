import 'server-only';
import { redirect } from 'next/navigation';
import { ApiError, FormProblem, errorMessage } from './api';

/** Reads a trimmed text field; empty becomes undefined. */
export function text(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An id that is safe to put in an API path. Anything else becomes "invalid", which the API
 * rejects, so a tampered field can never point a request at a different endpoint.
 */
export function uuidField(form: FormData, name: string): string {
  const value = text(form, name);
  return value && UUID.test(value) ? value : 'invalid';
}

export function integer(form: FormData, name: string): number | undefined {
  const value = text(form, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new FormProblem(`“${value}” is not a whole number.`);
  return parsed;
}

/** "1,299.99" → 129999 cents. Anything that is not a price stops the action with a clear message. */
export function cents(form: FormData, name: string): number | undefined {
  const raw = text(form, name);
  const value = raw?.replace(/[,$\s]/g, '');
  if (value === undefined) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new FormProblem(`“${raw}” is not a price. Enter it like 1299.00.`);
  }
  return Math.round(Number(value) * 100);
}

export function checked(form: FormData, name: string): boolean {
  return form.get(name) === 'on';
}

/** "Color = Graphite" lines (or "a = 1; b = 2") → { Color: "Graphite" }. */
export function pairs(form: FormData, name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of (text(form, name) ?? '').split(/[\n;]/)) {
    const [key, ...rest] = line.split('=');
    const k = key?.trim();
    const v = rest.join('=').trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export function withMessage(path: string, kind: 'notice' | 'error', message: string): string {
  const url = new URL(path, 'http://ops.local');
  url.searchParams.delete('notice');
  url.searchParams.delete('error');
  url.searchParams.set(kind, message);
  return `${url.pathname}${url.search}`;
}

/**
 * Runs one staff action against the API and comes back to `path` with a banner.
 * Expired sessions go to sign-in; missing two-step verification goes to setup.
 */
export async function perform(
  path: string,
  action: () => Promise<unknown>,
  success: string,
  next?: (result: unknown) => string,
): Promise<never> {
  let target: string;
  try {
    const result = await action();
    target = withMessage(next ? next(result) : path, 'notice', success);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login?expired=1');
    if (error instanceof ApiError && error.code === 'MFA_REQUIRED') redirect('/security/setup');
    target = withMessage(path, 'error', errorMessage(error));
  }
  redirect(target);
}
