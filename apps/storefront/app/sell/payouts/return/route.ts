import { type SellerView } from '@nixzora/validation';
import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/params';
import { api, errorMessage } from '@/lib/api';

/** Where the payout provider returns the seller: re-read their verification status. */
export async function GET() {
  const to = new URL('/sell', SITE_URL);
  try {
    const seller = await api<SellerView>('/seller/payouts/refresh', { method: 'POST' });
    to.searchParams.set(
      'notice',
      seller.payouts.detailsSubmitted
        ? 'Verification submitted. We will review your store shortly.'
        : 'Verification is not finished yet. Continue whenever you are ready.',
    );
  } catch (error) {
    to.searchParams.set('error', errorMessage(error));
  }
  return NextResponse.redirect(to);
}
