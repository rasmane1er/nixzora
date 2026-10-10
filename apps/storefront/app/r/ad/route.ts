import { type AdClickResult } from '@nixzora/validation';
import { type NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { SITE_URL } from '@/lib/params';
import { ensureVisitorId } from '@/lib/visitor';

/**
 * A shopper opened a sponsored product (p10-01): the API records the click (and decides whether
 * it is charged), then the shopper lands on the product. A broken or old link still lands
 * somewhere useful. Search engines are kept out (robots.ts).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t');
  if (!token) return NextResponse.redirect(new URL('/', SITE_URL), 303);
  try {
    const visitorId = await ensureVisitorId();
    const { slug } = await api<AdClickResult>('/ads/clicks', {
      method: 'POST',
      body: { token, visitorId },
    });
    return NextResponse.redirect(new URL(`/p/${encodeURIComponent(slug)}`, SITE_URL), 303);
  } catch {
    return NextResponse.redirect(new URL('/', SITE_URL), 303);
  }
}
