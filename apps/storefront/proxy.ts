import { type NextRequest, NextResponse } from 'next/server';
import { contentSecurityPolicy } from './lib/content-security-policy';

/**
 * Runs before every page. Keeps customers signed in by rotating the refresh token when the
 * 15-minute access token is missing or about to expire, and sends signed-out visitors away
 * from account pages. Shopping, cart and checkout work without an account.
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const secure = process.env.NODE_ENV === 'production';
const OPEN_ACCOUNT_PAGES = [
  '/account/login',
  '/account/register',
  '/account/forgot-password',
  '/account/reset-password',
  '/account/verify-email',
];

type Tokens = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};
type RefreshResult = { ok: true; tokens: Tokens } | { ok: false; status: number };

/**
 * Refresh tokens are single-use and a replay revokes the session. Pages often fire several
 * requests at once (prefetches), so concurrent refreshes with the same token share one call,
 * and the result is reused for a few seconds while the browser picks up the new cookies.
 */
const recent = new Map<string, { at: number; result: Promise<RefreshResult> }>();

function refreshOnce(refreshToken: string): Promise<RefreshResult> {
  const now = Date.now();
  for (const [key, entry] of recent) if (now - entry.at > 20_000) recent.delete(key);
  const cached = recent.get(refreshToken);
  if (cached) return cached.result;

  const result = fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'nixzora-storefront' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  })
    .then(async (res): Promise<RefreshResult> =>
      res.ok
        ? { ok: true, tokens: (await res.json()) as Tokens }
        : { ok: false, status: res.status },
    )
    .catch((): RefreshResult => ({ ok: false, status: 503 }));
  recent.set(refreshToken, { at: now, result });
  return result;
}

function expiresSoon(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as {
      exp?: number;
    };
    return !payload.exp || payload.exp * 1000 - Date.now() < 60_000;
  } catch {
    return true;
  }
}

function needsAccount(pathname: string): boolean {
  // The seller portal: /sell itself is the public pitch, everything under it needs an account.
  if (pathname.startsWith('/sell/')) return true;
  return (
    (pathname === '/account' || pathname.startsWith('/account/')) &&
    !OPEN_ACCOUNT_PAGES.some((path) => pathname.startsWith(path))
  );
}

function toLogin(request: NextRequest): NextResponse {
  const url = new URL('/account/login', request.url);
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

async function session(request: NextRequest): Promise<NextResponse> {
  const access = request.cookies.get('nx_at')?.value;
  const refresh = request.cookies.get('nx_rt')?.value;

  if (!expiresSoon(access)) return NextResponse.next();
  if (!refresh)
    return needsAccount(request.nextUrl.pathname) ? toLogin(request) : NextResponse.next();

  const res = await refreshOnce(refresh);

  if (!res.ok) {
    // Only a definite "no" signs the customer out; a network blip keeps the cookies.
    if (res.status < 500) {
      const out = needsAccount(request.nextUrl.pathname) ? toLogin(request) : NextResponse.next();
      out.cookies.delete('nx_at');
      out.cookies.delete('nx_rt');
      return out;
    }
    return NextResponse.next();
  }

  const tokens = res.tokens;
  request.cookies.set('nx_at', tokens.accessToken);
  request.cookies.set('nx_rt', tokens.refreshToken);
  const out = NextResponse.next({ request: { headers: request.headers } });
  const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  out.cookies.set('nx_at', tokens.accessToken, { ...base, maxAge: tokens.accessTokenExpiresIn });
  out.cookies.set('nx_rt', tokens.refreshToken, {
    ...base,
    maxAge: Math.floor((Date.parse(tokens.refreshTokenExpiresAt) - Date.now()) / 1000),
  });
  return out;
}

const API_ORIGIN = new URL(API_URL).origin;
const DEV = process.env.NODE_ENV !== 'production';

/** Every page: the session handling above, then the Content Security Policy. */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = await session(request);
  const https =
    request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicy({ apiOrigin: API_ORIGIN, https, dev: DEV }),
  );
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/|\\.well-known/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|ico|webp|avif|woff2?)$).*)',
  ],
};
