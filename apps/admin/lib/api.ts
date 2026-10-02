import 'server-only';
import { redirect } from 'next/navigation';
import { clientHeaders } from './client-headers';
import { accessToken } from './session';

export const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export type ApiIssue = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly issues: ApiIssue[] = [],
  ) {
    super(message);
  }

  /** One readable line for a banner: the message plus any field problems. */
  get summary(): string {
    return this.issues.length
      ? `${this.message} ${this.issues.map((issue) => `${issue.field}: ${issue.message}`).join('; ')}`
      : this.message;
  }
}

type Options = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Send without the signed-in user's token (sign-in endpoints). */
  anonymous?: boolean;
};

/** Calls the NIXZORA API from the server with the signed-in staff member's token. */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;
  const token = anonymous ? undefined : await accessToken();

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...rest,
    cache: 'no-store',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'User-Agent': 'nixzora-ops-center',
      ...(await clientHeaders()),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return data as T;

  const message =
    typeof data.message === 'string' ? data.message : `Request failed (${res.status}).`;
  throw new ApiError(
    res.status,
    message,
    typeof data.code === 'string' ? data.code : undefined,
    Array.isArray(data.issues) ? (data.issues as ApiIssue[]) : [],
  );
}

/**
 * For pages: send people where they need to go instead of showing a raw error.
 * 401 → sign in again; 403 MFA_REQUIRED → set up two-step verification.
 */
export async function load<T>(path: string): Promise<T> {
  try {
    return await api<T>(path);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) redirect('/login?expired=1');
      if (error.code === 'MFA_REQUIRED') redirect('/security/setup');
    }
    throw error;
  }
}

/** A problem with what staff typed, caught before calling the API. */
export class FormProblem extends Error {}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.summary;
  if (error instanceof FormProblem) return error.message;
  return 'Something went wrong. Try again.';
}
