import { rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('legal');
  return { title: t('aboutTitle'), description: t('aboutDescription') };
}

export default async function AboutPage() {
  const [t, tc] = await Promise.all([getT('legal'), getT('common')]);
  return (
    <LegalPage title={t('aboutTitle')} updated="2026-10-03">
      <p>{t('aboutIntro')}</p>
      <h2>{t('aboutTrustTitle')}</h2>
      <p>
        {rich(t('aboutTrustBody'), {
          returns: (c) => (
            <Link key="returns" href="/policies/returns">
              {c}
            </Link>
          ),
        })}
      </p>
      <h2>{t('aboutDataTitle')}</h2>
      <p>
        {rich(t('aboutDataBody'), {
          privacy: (c) => (
            <Link key="privacy" href="/privacy">
              {c}
            </Link>
          ),
        })}
      </p>
      <h2>{t('aboutSellTitle')}</h2>
      <p>
        {rich(t('aboutSellBody'), {
          sell: (c) => (
            <Link key="sell" href="/sell">
              {c}
            </Link>
          ),
        })}
      </p>
      <p className="muted">{tc('demoNotice')}</p>
    </LegalPage>
  );
}
