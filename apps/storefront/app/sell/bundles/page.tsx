import { type BundleView, type PagedResult, type SellerProductRow } from '@nixzora/validation';
import type { Metadata } from 'next';
import { BundleForm, BundleTable } from '@/components/BundleManager';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { archiveBundle, createBundle } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('bundles');
  return { title: t('manageMeta'), robots: { index: false } };
}

/** Seller portal: Bundle & save on the store's own listings (p10-16). */
export default async function SellerBundlesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const seller = await requireSeller('/sell/bundles');
  const active = seller.status === 'ACTIVE';
  const [bundles, products, t] = await Promise.all([
    active ? api<BundleView[]>('/seller/bundles').catch((): BundleView[] => []) : [],
    active
      ? api<PagedResult<SellerProductRow>>('/seller/products?status=ACTIVE&pageSize=100')
          .then((r) => r.items)
          .catch((): SellerProductRow[] => [])
      : [],
    getT('bundles'),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/bundles" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="stack" style={{ gap: 6 }}>
        <h2>{t('manageTitle')}</h2>
        <p className="muted" style={{ maxWidth: 760 }}>
          {t('manageLead')}
        </p>
      </div>
      <BundleForm products={products} action={createBundle} />
      <BundleTable bundles={bundles} archive={archiveBundle} />
    </div>
  );
}
