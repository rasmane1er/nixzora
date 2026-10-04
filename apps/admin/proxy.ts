import { type NextRequest, NextResponse } from 'next/server';
import { contentSecurityPolicy } from './lib/content-security-policy';

/**
 * Runs before every page. Keeps staff signed in by rotating the refresh token when the
 * 15-minute access token is missing or about to expire, and sends signed-out visitors
 * to the sign-in page. Pages then always render with a fresh token.
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const PUBLIC_PATHS = ['/login'];
const secure = process.env.NODE_ENV === 'production';

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
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'nixzora-ops-center' },
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

/** Continue to the page, forwarding the request headers this proxy set (nonce, cookies). */
function pass(request: NextRequest): NextResponse {
  return NextResponse.next({ request: { headers: request.headers } });
}

async function session(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return pass(request);
  }

  const access = request.cookies.get('nx_at')?.value;
  const refresh = request.cookies.get('nx_rt')?.value;
  if (!expiresSoon(access)) return pass(request);
  if (!refresh) return NextResponse.redirect(new URL('/login', request.url));

  const res = await refreshOnce(refresh);

  if (!res.ok) {
    // The API is down: let the page render its own error rather than signing staff out.
    if (res.status >= 500) return pass(request);
    const out = NextResponse.redirect(new URL('/login?expired=1', request.url));
    out.cookies.delete('nx_at');
    out.cookies.delete('nx_rt');
    return out;
  }

  const tokens = res.tokens;

  // Hand the new token to this request's render, and to the browser for the next one.
  request.cookies.set('nx_at', tokens.accessToken);
  request.cookies.set('nx_rt', tokens.refreshToken);
  const out = pass(request);
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
  // A fresh nonce per page view. Next.js reads it from the request's policy header and puts it
  // on its own scripts; any other inline script is refused by the browser.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const https =
    request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  const policy = contentSecurityPolicy({ apiOrigin: API_ORIGIN, https, dev: DEV, nonce });
  request.headers.set('x-nonce', nonce);
  request.headers.set('Content-Security-Policy', policy);

  const response = await session(request);
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ['/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico|woff2?)$).*)'],
};
