import { type SpendOfferView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { Notices, SellerNav } from '@/components/SellerNav';
import { SpendOfferForm, SpendOfferTable } from '@/components/SpendOfferManager';
import { api } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { createSpendOffer, endSpendOffer } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('spendSave');
  return { title: t('navTitle'), robots: { index: false } };
}

/** Seller portal: Spend more, save more tiers on everything the store sells (p10-31). */
export default async function SellerSpendOffersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const seller = await requireSeller('/sell/spend-offers');
  const active = seller.status === 'ACTIVE';
  const [offers, t] = await Promise.all([
    active ? api<SpendOfferView[]>('/seller/spend-offers').catch((): SpendOfferView[] => []) : [],
    getT('spendSave'),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/spend-offers" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="stack" style={{ gap: 6 }}>
        <h2>{t('navTitle')}</h2>
        <p className="muted" style={{ maxWidth: 760 }}>
          {t('lead')}
        </p>
      </div>
      {active ? <SpendOfferForm offers={offers} action={createSpendOffer} /> : null}
      <SpendOfferTable offers={offers} end={endSpendOffer} />
    </div>
  );
}
