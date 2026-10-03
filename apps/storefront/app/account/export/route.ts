import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { SITE_URL } from '@/lib/params';

/** "Download your data": the account export as a JSON file. */
export async function GET() {
  try {
    const data = await api<unknown>('/me/export');
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="nixzora-account-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const to = new URL('/account/privacy', SITE_URL);
    if (error instanceof ApiError && error.status === 401) {
      to.pathname = '/account/login';
      to.searchParams.set('next', '/account/privacy');
    } else {
      to.searchParams.set('error', 'We could not prepare your data. Try again in a minute.');
    }
    return NextResponse.redirect(to);
  }
}
