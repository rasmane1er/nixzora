import { type DealView, type PagedResult, type SellerProductRow } from '@nixzora/validation';
import type { Metadata } from 'next';
import { DealTable } from '@/components/DealTable';
import { Notices, SellerNav } from '@/components/SellerNav';
import { DealForm } from '@/components/DealForm';
import { api } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { cancelDeal, createDeal } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('deals');
  return { title: t('manageMeta'), robots: { index: false } };
}

/** Seller portal: limited-time deals on the store's own listings (p10-07). */
export default async function SellerDealsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const seller = await requireSeller('/sell/deals');
  const active = seller.status === 'ACTIVE';
  const [deals, products, t] = await Promise.all([
    active ? api<DealView[]>('/seller/deals').catch((): DealView[] => []) : [],
    active
      ? api<PagedResult<SellerProductRow>>('/seller/products?status=ACTIVE&pageSize=100')
          .then((r) => r.items)
          .catch((): SellerProductRow[] => [])
      : [],
    getT('deals'),
  ]);

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/deals" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="stack" style={{ gap: 6 }}>
        <h2>{t('manageTitle')}</h2>
        <p className="muted" style={{ maxWidth: 760 }}>
          {t('manageLead')}
        </p>
      </div>
      {products.length ? (
        <DealForm products={products} action={createDeal} />
      ) : (
        <p className="banner banner--info">{t('noProducts')}</p>
      )}
      <DealTable deals={deals} cancel={cancelDeal} />
    </div>
  );
}
