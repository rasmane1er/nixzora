import type {
  ProductAlertKind,
  ProductAlertRef,
  QuestionPage,
  QuestionView,
  Facet,
  ProductPage,
  SearchSuggestions,
  AdClickResult,
  AdPlacement,
  SponsoredProducts,
  DeviceSignInCredential,
  DeviceSignInEnableRequest,
  DeviceSignInRequest,
  DeviceSignInResponse,
  DeviceSignInSummary,
  PasskeySummary,
  AccountCoupon,
  SupportRequestCreate,
  SupportRequestView,
  UploadRequest,
  UploadTicket,
  AccountOrder,
  AccountOrderQuery,
  AccountOverview,
  AccountPreferences,
  AccountProfile,
  AccountReview,
  AddressCreate,
  AddressUpdate,
  BuyAgainItem,
  ProfileUpdate,
  SessionSummary,
  SellerRatingCreate,
  Address,
  AssistantChatResponse,
  AssistantMessage,
  AuthTokens,
  Cart,
  CategoryNode,
  CheckoutResponse,
  LoginResponse,
  SocialProvidersResponse,
  RelatedProducts,
  ReviewInsights,
  Recommendations,
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
  ReviewCreate,
  ReviewListQuery,
  ReviewPage,
  ReviewView,
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
  /** The reader's language ("en", "fr", "es"), sent as Accept-Language. */
  language?: () => string | undefined;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

type Query = Record<string, string | number | boolean | undefined | null | readonly string[]>;

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
    // Arrays repeat the key: f=color:Black&f=size:M.
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
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
    const language = options.language?.();
    if (language) headers['Accept-Language'] = language;
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
        /** E.164, e.g. "+13015550199". */
        phone?: string;
        acceptTerms?: true;
        marketingEmails?: boolean;
        deviceName?: string;
        language?: 'en' | 'fr' | 'es';
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
      /** Face ID / fingerprint sign-in: answers with a session and the rotated device secret. */
      deviceSignIn: (body: DeviceSignInRequest) =>
        request<DeviceSignInResponse>('POST', '/auth/device', { body, auth: 'none' }),
      me: () => request<MeResponse>('GET', '/auth/me'),
    },

    catalog: {
      categories: () => request<CategoryNode[]>('GET', '/catalog/categories', { auth: 'none' }),
      /** A page of products; `correctedQuery` says when a misspelled search was fixed. */
      products: (query: Partial<ProductListQuery> = {}) =>
        request<ProductPage>('GET', '/catalog/products', {
          query: query as Query,
          auth: 'none',
        }),
      /** Spec and option filters for a search, category, brand or store, with counts. */
      facets: (query: Partial<ProductListQuery> = {}) =>
        request<{ facets: Facet[] }>('GET', '/catalog/facets', {
          query: query as Query,
          auth: 'none',
        }).then((res) => res.facets),
      /** Searches, departments, brands and products for what the shopper is typing. */
      suggest: (q: string) =>
        request<SearchSuggestions>('GET', '/catalog/suggest', { query: { q }, auth: 'none' }),
      product: (slug: string) =>
        request<ProductDetail>('GET', `/catalog/products/${enc(slug)}`, { auth: 'none' }),
      /** A page of a product's approved reviews (10 at a time), with the rating summary. */
      reviews: (slug: string, query: Partial<ReviewListQuery> = {}) =>
        request<ReviewPage>('GET', `/catalog/products/${enc(slug)}/reviews`, {
          query: { page: query.page ?? 1, sort: query.sort ?? 'relevant', rating: query.rating },
          auth: 'none',
        }),
      /** "What customers say" for a product; null until it has 3 approved reviews. */
      reviewInsights: (slug: string) =>
        request<{ insights: ReviewInsights | null }>(
          'GET',
          `/catalog/products/${enc(slug)}/reviews/insights`,
          { auth: 'none' },
        ).then((res) => res.insights),
      /**
       * Your own review of a product (any status) or null, and whether you may write one:
       * only once the product was delivered to you.
       */
      myReview: (slug: string) =>
        request<{
          review: (ReviewView & { status: AccountReview['status'] }) | null;
          canReview: boolean;
          /** Reviews of this product you marked helpful. */
          helpfulVotes?: string[];
        }>('GET', `/catalog/products/${enc(slug)}/reviews/mine`),
      /** "Was this helpful?" — false takes the vote back. */
      voteHelpful: (reviewId: string, helpful: boolean) =>
        request<{ helpfulCount: number; voted: boolean }>(
          'POST',
          `/catalog/reviews/${enc(reviewId)}/helpful`,
          { body: { helpful } },
        ),
      /** A link to upload one review photo; send its storageKey in `photoKeys`. */
      reviewPhotoUpload: (body: UploadRequest) =>
        request<UploadTicket>('POST', '/catalog/reviews/photos/upload', { body }),
      /** Questions and answers on a product page; `canAnswer` is for the signed-in shopper. */
      questions: (slug: string, query: { page?: number; q?: string } = {}) =>
        request<QuestionPage>('GET', `/catalog/products/${enc(slug)}/questions`, {
          query: query as Query,
        }),
      ask: (slug: string, body: string) =>
        request<QuestionView>('POST', `/catalog/products/${enc(slug)}/questions`, {
          body: { body },
        }),
      answer: (questionId: string, body: string) =>
        request<QuestionView>('POST', `/catalog/questions/${enc(questionId)}/answers`, {
          body: { body },
        }),
      /** Create or update your review; it is published after moderation. */
      submitReview: (slug: string, body: ReviewCreate) =>
        request<{ status: string }>('POST', `/catalog/products/${enc(slug)}/reviews`, { body }),
      /** Similar, bought-together and also-viewed products for a product page. */
      related: (slug: string) =>
        request<RelatedProducts>('GET', `/catalog/products/${enc(slug)}/related`, { auth: 'none' }),
      lookup: (code: string) =>
        request<ProductLookup>('GET', '/catalog/lookup', { query: { code }, auth: 'none' }),
    },

    recommendations: {
      /** Records that this shopper opened a product page (signed in, or by visitor id). */
      view: (productId: string, visitorId?: string) =>
        request<void>('POST', '/events/views', { body: { productId, visitorId } }),
      /** Picks from viewing history (and smart rows), or popular products. */
      forYou: (visitorId?: string) =>
        request<Recommendations>('GET', '/recommendations', {
          query: visitorId ? { visitorId } : {},
          cart: true,
        }),
      /** Records a search, for "Because you searched for…" picks. */
      search: (q: string, visitorId?: string) =>
        request<void>('POST', '/events/searches', { body: { q, visitorId } }),
      /** Forgets this account's (and this device's) views and searches. */
      clearHistory: (visitorId?: string) =>
        request<void>('DELETE', '/me/shopping-history', {
          query: visitorId ? { visitorId } : {},
        }),
    },

    ads: {
      /** Sponsored products for a page; often none. */
      forPage: (
        query: { placement: AdPlacement; q?: string; category?: string; product?: string },
        visitorId?: string,
      ) =>
        request<SponsoredProducts>('GET', '/ads', {
          query: { ...query, ...(visitorId ? { visitorId } : {}) },
        }),
      /** The shopper opened an ad: records the click, returns the product to open. */
      click: (token: string, visitorId?: string) =>
        request<AdClickResult>('POST', '/ads/clicks', { body: { token, visitorId } }),
    },

    assistant: {
      /** The AI shopping assistant: products and prices in the answer come from the catalog. */
      chat: (messages: AssistantMessage[], visitorId?: string) =>
        request<AssistantChatResponse>('POST', '/assistant/chat', {
          body: { messages, ...(visitorId ? { visitorId } : {}) },
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
      /** Rate a delivered seller parcel 1–5 (or change it); returns the updated order. */
      rateSeller: (number: string, body: SellerRatingCreate, token?: string) =>
        request<OrderView>('POST', `/orders/${enc(number)}/seller-ratings`, {
          body,
          query: { token },
          auth: token ? 'none' : 'auto',
        }),
    },

    /** Your Account (the account hub). */
    me: {
      overview: () => request<AccountOverview>('GET', '/me/overview'),
      profile: () => request<AccountProfile>('GET', '/me/profile'),
      setLanguage: (language: 'en' | 'fr' | 'es') =>
        request<AccountProfile>('PUT', '/me/language', { body: { language } }),
      updateProfile: (body: ProfileUpdate) =>
        request<AccountProfile>('PATCH', '/me/profile', { body }),
      orderHistory: (query: Partial<AccountOrderQuery> = {}) =>
        request<PagedResult<AccountOrder>>('GET', '/me/order-history', {
          query: query as Record<string, string | number | undefined>,
        }),
      buyAgain: () => request<BuyAgainItem[]>('GET', '/me/buy-again'),
      returns: () => request<ReturnView[]>('GET', '/me/returns'),
      reviews: () => request<AccountReview[]>('GET', '/me/reviews'),
      preferences: () => request<AccountPreferences>('GET', '/me/preferences'),
      setPreferences: (body: AccountPreferences) =>
        request<AccountPreferences>('PUT', '/me/preferences', { body }),
      sessions: () => request<SessionSummary[]>('GET', '/me/sessions'),
      revokeSession: (id: string) => request<void>('DELETE', `/me/sessions/${enc(id)}`),
      revokeOtherSessions: () => request<void>('DELETE', '/me/sessions'),
      passkeys: () => request<PasskeySummary[]>('GET', '/me/passkeys'),
      removePasskey: (id: string) => request<void>('DELETE', `/me/passkeys/${enc(id)}`),
      deviceSignIns: () => request<DeviceSignInSummary[]>('GET', '/me/device-sign-ins'),
      /** Turns on Face ID / fingerprint sign-in for this phone; the secret is shown once. */
      enableDeviceSignIn: (body: DeviceSignInEnableRequest) =>
        request<DeviceSignInCredential>('POST', '/me/device-sign-ins', { body }),
      revokeDeviceSignIn: (id: string) => request<void>('DELETE', `/me/device-sign-ins/${enc(id)}`),
      changePassword: (body: { currentPassword: string; newPassword: string }) =>
        request<void>('POST', '/auth/password/change', { body }),
      createAddress: (body: AddressCreate) =>
        request<SavedAddress>('POST', '/me/addresses', { body }),
      updateAddress: (id: string, body: AddressUpdate) =>
        request<SavedAddress>('PATCH', `/me/addresses/${enc(id)}`, { body }),
      deleteAddress: (id: string) => request<void>('DELETE', `/me/addresses/${enc(id)}`),
      coupons: () => request<AccountCoupon[]>('GET', '/me/coupons'),
      avatarUpload: (body: UploadRequest) =>
        request<UploadTicket>('POST', '/me/avatar/upload', { body }),
      setAvatar: (storageKey: string) =>
        request<AccountProfile>('PUT', '/me/avatar', { body: { storageKey } }),
      removeAvatar: () => request<AccountProfile>('DELETE', '/me/avatar'),
      supportRequests: () => request<SupportRequestView[]>('GET', '/me/support-requests'),
    },

    support: {
      /** Contact us / Report a problem (signed in, or with an email). */
      create: (body: SupportRequestCreate) =>
        request<SupportRequestView>('POST', '/support/requests', { body }),
    },

    account: {
      /** Permanently closes the account (password required). */
      /** Accounts with a password confirm with it; Google/Apple-only accounts send "DELETE". */
      delete: (confirmation: { password: string } | { confirm: 'DELETE' }) =>
        request<void>('DELETE', '/me', { body: confirmation }),
      addresses: () => request<SavedAddress[]>('GET', '/me/addresses'),
      wishlist: () => request<ProductCard[]>('GET', '/me/wishlist'),
      wishlistIds: () => request<string[]>('GET', '/me/wishlist/ids'),
      /** Back-in-stock and price-drop alerts you have (p10-06). */
      alerts: () => request<ProductAlertRef[]>('GET', '/me/alerts'),
      setAlert: (productId: string, kind: ProductAlertKind, on: boolean) =>
        request<void>(on ? 'PUT' : 'DELETE', `/me/alerts/${enc(productId)}`, { query: { kind } }),
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
