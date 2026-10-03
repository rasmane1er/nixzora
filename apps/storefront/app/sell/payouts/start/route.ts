import { type PayoutOnboardingLink } from '@nixzora/validation';
import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/params';
import { api, ApiError, errorMessage } from '@/lib/api';

/**
 * Sends the seller to the payout provider's hosted onboarding (Stripe Connect). A GET route, so
 * Stripe can also send sellers back here when an onboarding link expires.
 */
export async function GET() {
  try {
    const { url } = await api<PayoutOnboardingLink>('/seller/payouts/onboarding', {
      method: 'POST',
    });
    return NextResponse.redirect(url);
  } catch (error) {
    const to = new URL('/sell', SITE_URL);
    if (error instanceof ApiError && error.status === 401) {
      to.pathname = '/account/login';
      to.searchParams.set('next', '/sell');
    } else {
      to.searchParams.set('error', errorMessage(error));
    }
    return NextResponse.redirect(to);
  }
}
