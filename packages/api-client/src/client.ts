import type {
  Address,
  AssistantChatResponse,
  AssistantMessage,
  AuthTokens,
  Cart,
  CategoryNode,
  CheckoutResponse,
  LoginResponse,
  SocialProvidersResponse,
  SocialSignInRequest,
  MeResponse,
  OrderSummary,
  OrderView,
  PagedResult,
  PaymentSession,
  ProductCard,
  ProductDetail,
  ProductListQuery,
  ProductLookup,
  PushDeviceRegister,
  ReturnCreate,
  ReturnView,
  SavedAddress,
  UsState,
} from '@nixzora/validation';
import { ApiError, type ApiIssue } from './errors';

/**
 * How the client reads the app's session. The app owns token storage (Keychain/Keystore);
 * the client only asks for the current access token and for a refresh when it expires.
 */
export type SessionHooks = {
  accessToken(): string | null;
  /** Rotates the refresh token and returns a new access token, or null when signed out. */
  refresh(): Promise<string | null>;
  /** The guest cart id (signed-in carts belong to the account). */
  cartId?(): string | null;
  /** Called when the API hands out a guest cart id. */
  onCartId?(cartId: string): void;
};

export type ClientOptions = {
  /** e.g. https://api.nixzora.shop — without /api/v1. */
  baseUrl: string;
  session?: SessionHooks;
  /** Sent as User-Agent context, e.g. "nixzora-ios/1.0.0". */
  clientName?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

type Query = Record<string, string | number | boolean | undefined | null>;

type RequestOptions = {
  body?: unknown;
  query?: Query;
  /** "none" never sends the token; "auto" sends it when signed in (default). */
  auth?: 'auto' | 'none';
  /** Send X-Cart-Id for guests. */
  cart?: boolean;
  /** Use this token instead of the session's (sign-out uses it after local tokens are cleared). */
  token?: string;
};

export function queryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function toError(response: Response): Promise<ApiError> {
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return new ApiError(
    response.status,
    typeof data.message === 'string' ? data.message : `Request failed (${response.status}).`,
    typeof data.code === 'string' ? data.code : undefined,
    Array.isArray(data.issues) ? (data.issues as ApiIssue[]) : [],
  );
}

export function createApiClient(options: ClientOptions) {
  const base = `${options.baseUrl.replace(/\/$/, '')}/api/v1`;
  // Looked up per request, so polyfills and test doubles installed later are used.
  const doFetch: typeof fetch = (input, init) => (options.fetch ?? globalThis.fetch)(input, init);
  const session = options.session;
  let refreshing: Promise<string | null> | null = null;

  /** One refresh at a time: parallel 401s wait for the same new token. */
  function refreshOnce(): Promise<string | null> {
    if (!session) return Promise.resolve(null);
    refreshing ??= session.refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function send(
    method: string,
    path: string,
    opts: RequestOptions,
    token: string | null,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const cartId = opts.cart && !token ? session?.cartId?.() : null;
    if (cartId) headers['X-Cart-Id'] = cartId;
    if (options.clientName) headers['X-Client'] = options.clientName;
    try {
      return await doFetch(`${base}${path}${queryString(opts.query)}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      });
    } catch (error) {
      throw new ApiError(0, (error as Error).message || 'Network request failed.');
    }
  }

  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const auto = opts.auth !== 'none';
    let token = opts.token ?? (auto ? (session?.accessToken() ?? null) : null);
    let response = await send(method, path, opts, token);

    // Access tokens live 15 minutes: refresh once and retry.
    if (response.status === 401 && token && auto && !opts.token) {
      token = await refreshOnce();
      if (token) response = await send(method, path, opts, token);
    }

    if (!response.ok) throw await toError(response);
    if (response.status === 204) return undefined as T;
    const data = (await response.json()) as T;
    const cartId = (data as { cartId?: unknown } | null)?.cartId;
    if (opts.cart && typeof cartId === 'string') session?.onCartId?.(cartId);
    return data;
  }

  const enc = encodeURIComponent;

  return {
    request,

    auth: {
      login: (body: { email: string; password: string; deviceName?: string }) =>
        request<LoginResponse>('POST', '/auth/login', { body, auth: 'none' }),
      register: (body: {
        email: string;
        password: string;
        firstName?: string;
        lastName?: string;
        deviceName?: string;
      }) => request<AuthTokens>('POST', '/auth/register', { body, auth: 'none' }),
      completeMfa: (mfaToken: string, code: string) =>
        request<AuthTokens>('POST', '/auth/mfa/challenge', {
          body: { mfaToken, code },
          auth: 'none',
        }),
      /** Exchanges a refresh token for new tokens (the old refresh token stops working). */
      refresh: (refreshToken: string) =>
        request<AuthTokens>('POST', '/auth/refresh', { body: { refreshToken }, auth: 'none' }),
      logout: (accessToken: string) =>
        request<void>('POST', '/auth/logout', { token: accessToken }),
      /** Which sign-in buttons to show, with the public client ids the app needs. */
      socialProviders: () =>
        request<SocialProvidersResponse>('GET', '/auth/social/providers', { auth: 'none' }),
      /** Sign in (or sign up) with a Google or Apple ID token. */
      social: (body: SocialSignInRequest) =>
        request<LoginResponse>('POST', '/auth/social', { body, auth: 'none' }),
      forgotPassword: (email: string) =>
        request<void>('POST', '/auth/password/forgot', { body: { email }, auth: 'none' }),
      me: () => request<MeResponse>('GET', '/auth/me'),
    },

    catalog: {
      categories: () => request<CategoryNode[]>('GET', '/catalog/categories', { auth: 'none' }),
      products: (query: Partial<ProductListQuery> = {}) =>
        request<PagedResult<ProductCard>>('GET', '/catalog/products', {
          query: query as Query,
          auth: 'none',
        }),
      product: (slug: string) =>
        request<ProductDetail>('GET', `/catalog/products/${enc(slug)}`, { auth: 'none' }),
      lookup: (code: string) =>
        request<ProductLookup>('GET', '/catalog/lookup', { query: { code }, auth: 'none' }),
    },

    assistant: {
      /** The AI shopping assistant: products and prices in the answer come from the catalog. */
      chat: (messages: AssistantMessage[]) =>
        request<AssistantChatResponse>('POST', '/assistant/chat', {
          body: { messages },
          auth: 'none',
        }),
    },

    cart: {
      get: (region?: UsState) => request<Cart>('GET', '/cart', { query: { region }, cart: true }),
      add: (variantId: string, quantity = 1) =>
        request<Cart>('POST', '/cart/items', { body: { variantId, quantity }, cart: true }),
      update: (variantId: string, quantity: number) =>
        request<Cart>('PATCH', `/cart/items/${enc(variantId)}`, {
          body: { quantity },
          cart: true,
        }),
      remove: (variantId: string) =>
        request<Cart>('DELETE', `/cart/items/${enc(variantId)}`, { cart: true }),
      applyCoupon: (code: string) =>
        request<Cart>('POST', '/cart/coupon', { body: { code }, cart: true }),
      removeCoupon: () => request<Cart>('DELETE', '/cart/coupon', { cart: true }),
      /** After sign-in: move the guest cart's lines into the account's cart. */
      merge: (guestCartId: string) =>
        request<Cart>('POST', '/cart/merge', { body: { guestCartId } }),
    },

    checkout: {
      start: (body: {
        email: string;
        shippingAddress: Address;
        saveAddress?: boolean;
        cartId?: string;
      }) => request<CheckoutResponse>('POST', '/checkout', { body }),
      /** A new payment session for an unpaid order (after a declined card). */
      payment: (number: string, token?: string) =>
        request<PaymentSession>('POST', `/orders/${enc(number)}/payment`, { query: { token } }),
      /** Development only: completes a payment when the API uses the fake provider. */
      fakeConfirm: (clientSecret: string, outcome: 'succeeded' | 'failed' | 'canceled') =>
        request<{ status: string }>('POST', '/payments/fake/confirm', {
          body: { clientSecret, outcome },
          auth: 'none',
        }),
    },

    orders: {
      mine: () => request<OrderSummary[]>('GET', '/me/orders'),
      /** Signed in: the account's order. With a token: the link from the receipt email. */
      get: (number: string, token?: string) =>
        request<OrderView>('GET', `/orders/${enc(number)}`, {
          query: { token },
          auth: token ? 'none' : 'auto',
        }),
      requestReturn: (number: string, body: ReturnCreate, token?: string) =>
        request<ReturnView>('POST', `/orders/${enc(number)}/returns`, { body, query: { token } }),
      returns: (number: string, token?: string) =>
        request<ReturnView[]>('GET', `/orders/${enc(number)}/returns`, { query: { token } }),
    },

    account: {
      /** Permanently closes the account (password required). */
      /** Accounts with a password confirm with it; Google/Apple-only accounts send "DELETE". */
      delete: (confirmation: { password: string } | { confirm: 'DELETE' }) =>
        request<void>('DELETE', '/me', { body: confirmation }),
      addresses: () => request<SavedAddress[]>('GET', '/me/addresses'),
      wishlist: () => request<ProductCard[]>('GET', '/me/wishlist'),
      wishlistIds: () => request<string[]>('GET', '/me/wishlist/ids'),
      wish: (productId: string) => request<void>('PUT', `/me/wishlist/${enc(productId)}`),
      unwish: (productId: string) => request<void>('DELETE', `/me/wishlist/${enc(productId)}`),
    },

    devices: {
      register: (body: PushDeviceRegister) => request<void>('PUT', '/me/devices', { body }),
      remove: (token: string, accessToken?: string) =>
        request<void>('DELETE', '/me/devices', { body: { token }, token: accessToken }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
