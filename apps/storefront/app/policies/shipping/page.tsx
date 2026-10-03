import { rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('legal');
  return { title: t('shippingTitle'), description: t('shippingDescription') };
}

export default async function ShippingPolicyPage() {
  const t = await getT('legal');
  return (
    <LegalPage title={t('shippingTitle')} updated="2026-10-03" translationNote>
      <h2>{t('shippingWhereTitle')}</h2>
      <p>{t('shippingWhereBody')}</p>
      <h2>{t('shippingCostTitle')}</h2>
      <p>{t('shippingCostBody')}</p>
      <h2>{t('shippingWhenTitle')}</h2>
      <p>{t('shippingWhenBody')}</p>
      <h2>{t('shippingSellersTitle')}</h2>
      <p>{t('shippingSellersBody')}</p>
      <h2>{t('shippingProblemsTitle')}</h2>
      <p>
        {rich(t('shippingProblemsBody'), {
          contact: (c) => (
            <Link key="contact" href="/help/contact?topic=DELIVERY">
              {c}
            </Link>
          ),
        })}
      </p>
    </LegalPage>
  );
}
