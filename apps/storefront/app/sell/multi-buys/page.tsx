import { type MultiBuyView, type PagedResult, type SellerProductRow } from '@nixzora/validation';
import type { Metadata } from 'next';
import { MultiBuyForm, MultiBuyTable } from '@/components/MultiBuyManager';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { createMultiBuy, endMultiBuy } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('multiBuy');
  return { title: t('navTitle'), robots: { index: false } };
}

/** Seller portal: Buy X, get Y offers on the store's own listings (p10-27). */
export default async function SellerMultiBuysPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const seller = await requireSeller('/sell/multi-buys');
  const active = seller.status === 'ACTIVE';
  const [offers, products, t] = await Promise.all([
    active ? api<MultiBuyView[]>('/seller/multi-buys').catch((): MultiBuyView[] => []) : [],
    active
      ? api<PagedResult<SellerProductRow>>('/seller/products?status=ACTIVE&pageSize=100')
          .then((r) => r.items)
          .catch((): SellerProductRow[] => [])
      : [],
    getT('multiBuy'),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/multi-buys" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="stack" style={{ gap: 6 }}>
        <h2>{t('navTitle')}</h2>
        <p className="muted" style={{ maxWidth: 760 }}>
          {t('lead')}
        </p>
      </div>
      {active ? <MultiBuyForm products={products} offers={offers} action={createMultiBuy} /> : null}
      <MultiBuyTable offers={offers} end={endMultiBuy} />
    </div>
  );
}
