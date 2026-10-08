import { rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, LegalPage } from '@/components/LegalPage';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('legal');
  return { title: t('termsTitle'), description: t('termsDescription') };
}

export default async function TermsPage() {
  const t = await getT('legal');
  return (
    <LegalPage title={t('termsTitle')} updated="2026-10-07" translationNote>
      <p>
        {rich(t('termsIntro'), {
          privacy: (c) => (
            <Link key="privacy" href="/privacy">
              {c}
            </Link>
          ),
        })}
      </p>

      <h2>{t('termsAccountTitle')}</h2>
      <p>{t('termsAccountBody')}</p>

      <h2>{t('termsOrdersTitle')}</h2>
      <p>{t('termsOrdersBody')}</p>

      <h2>{t('termsShippingTitle')}</h2>
      <p>{t('termsShippingBody')}</p>

      <h2>{t('termsReturnsTitle')}</h2>
      <p>{t('termsReturnsBody')}</p>

      <h2>{t('termsProductTitle')}</h2>
      <p>{t('termsProductBody')}</p>

      <h2>{t('termsMarketplaceTitle')}</h2>
      <p>{t('termsMarketplaceBody')}</p>

      <h2>{t('termsReviewsTitle')}</h2>
      <p>{t('termsReviewsBody')}</p>

      <h2>{t('termsUseTitle')}</h2>
      <p>{t('termsUseBody')}</p>

      <h2>{t('termsLiabilityTitle')}</h2>
      <p>{t('termsLiabilityBody')}</p>

      <h2>{t('termsChangesTitle')}</h2>
      <p>
        {rich(t('termsChangesBody', { email: CONTACT_EMAIL }), {
          email: (c) => (
            <a key="email" href={`mailto:${CONTACT_EMAIL}`}>
              {c}
            </a>
          ),
        })}
      </p>
    </LegalPage>
  );
}
