import { type ClipCouponView, type PagedResult, type SellerProductRow } from '@nixzora/validation';
import type { Metadata } from 'next';
import { ClipCouponForm, ClipCouponTable } from '@/components/ClipCouponManager';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { createClipCoupon, endClipCoupon } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('clips');
  return { title: t('manageMeta'), robots: { index: false } };
}

/** Seller portal: clip coupons on the store's own listings (p10-18). */
export default async function SellerCouponsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const seller = await requireSeller('/sell/coupons');
  const active = seller.status === 'ACTIVE';
  const [coupons, products, t] = await Promise.all([
    active ? api<ClipCouponView[]>('/seller/coupons').catch((): ClipCouponView[] => []) : [],
    active
      ? api<PagedResult<SellerProductRow>>('/seller/products?status=ACTIVE&pageSize=100')
          .then((r) => r.items)
          .catch((): SellerProductRow[] => [])
      : [],
    getT('clips'),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/coupons" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="stack" style={{ gap: 6 }}>
        <h2>{t('manageTitle')}</h2>
        <p className="muted" style={{ maxWidth: 760 }}>
          {t('manageLead')}
        </p>
      </div>
      <ClipCouponForm products={products} action={createClipCoupon} />
      <ClipCouponTable coupons={coupons} end={endClipCoupon} />
    </div>
  );
}
