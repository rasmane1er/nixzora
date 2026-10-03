import { type SellerView } from '@nixzora/validation';
import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/params';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

/** Where the payout provider returns the seller: re-read their verification status. */
export async function GET() {
  const to = new URL('/sell', SITE_URL);
  try {
    const seller = await api<SellerView>('/seller/payouts/refresh', { method: 'POST' });
    const t = await getT('sellerTools');
    to.searchParams.set(
      'notice',
      seller.payouts.detailsSubmitted
        ? t('noticeVerificationSubmitted')
        : t('noticeVerificationUnfinished'),
    );
  } catch (error) {
    to.searchParams.set('error', errorMessage(error));
  }
  return NextResponse.redirect(to);
}
