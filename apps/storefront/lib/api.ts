import 'server-only';
import {
  type Cart,
  type CategoryNode,
  type HealthResponse,
  HealthResponseSchema,
  type PagedResult,
  type ProductCard,
  type ProductDetail,
} from '@nixzora/validation';
import { clientHeaders } from './client-headers';
import { getLocale } from './i18n';
import { accessToken, guestCartId } from './session';

export const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export type ApiIssue = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly issues: ApiIssue[] = [],
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }

  get summary(): string {
    return this.issues.length
      ? `${this.message} ${this.issues.map((issue) => `${issue.field}: ${issue.message}`).join('; ')}`
      : this.message;
  }
}

type Options = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Send the signed-in customer's token (default true when present). */
  auth?: boolean;
  /** Send the guest cart id. */
  cart?: boolean;
  /** Cache public catalog reads for this many seconds. */
  revalidate?: number;
};

/** Calls the NIXZORA API from the storefront server. */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { body, auth = true, cart = false, revalidate, headers, ...rest } = options;
  const token = auth ? await accessToken() : undefined;
  const cartId = cart ? await guestCartId() : undefined;
  // Cached public reads are shared by every visitor, so they carry no visitor identity.
  const relay = revalidate === undefined ? await clientHeaders() : {};
  // Error messages and emails in the visitor's language (not on shared cached reads).
  const language: Record<string, string> =
    revalidate === undefined ? { 'Accept-Language': await getLocale() } : {};

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...rest,
    ...(revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' as const }),
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cartId && !token ? { 'X-Cart-Id': cartId } : {}),
      'User-Agent': 'nixzora-storefront',
      ...relay,
      ...language,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return data as T;
  throw new ApiError(
    res.status,
    typeof data.message === 'string' ? data.message : `Request failed (${res.status}).`,
    typeof data.code === 'string' ? data.code : undefined,
    Array.isArray(data.issues) ? (data.issues as ApiIssue[]) : [],
    data,
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.summary;
  return 'Something went wrong. Try again.';
}

// ───── Catalog (public, cached briefly) ─────

export const catalog = {
  categories: () => api<CategoryNode[]>('/catalog/categories', { auth: false, revalidate: 60 }),
  brands: () =>
    api<{ id: string; slug: string; name: string }[]>('/catalog/brands', {
      auth: false,
      revalidate: 300,
    }),
  products: (query: string) =>
    api<PagedResult<ProductCard>>(`/catalog/products${query}`, { auth: false, revalidate: 30 }),
  product: (slug: string) =>
    api<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`, {
      auth: false,
      revalidate: 30,
    }),
};

export async function currentCart(region?: string): Promise<Cart | null> {
  try {
    return await api<Cart>(`/cart${region ? `?region=${region}` : ''}`, { cart: true });
  } catch {
    return null;
  }
}

export type HealthResult =
  { reachable: true; health: HealthResponse } | { reachable: false; error: string };

export async function getApiHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${API_URL}/api/v1/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    const parsed = HealthResponseSchema.safeParse(await res.json());
    if (!parsed.success)
      return { reachable: false, error: 'The API answered with an unexpected response.' };
    return { reachable: true, health: parsed.data };
  } catch {
    return { reachable: false, error: `Cannot reach the API at ${API_URL}. Is it running?` };
  }
}
