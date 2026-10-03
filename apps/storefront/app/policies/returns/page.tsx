import { rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('legal');
  return { title: t('returnsTitle'), description: t('returnsDescription') };
}

export default async function ReturnPolicyPage() {
  const t = await getT('legal');
  return (
    <LegalPage title={t('returnsTitle')} updated="2026-10-03" translationNote>
      <h2>{t('returnsWindowTitle')}</h2>
      <p>{t('returnsWindowBody')}</p>
      <h2>{t('returnsHowTitle')}</h2>
      <p>
        {rich(t('returnsHowBody'), {
          orders: (c) => (
            <Link key="orders" href="/account/orders">
              {c}
            </Link>
          ),
          returns: (c) => (
            <Link key="returns" href="/account/returns">
              {c}
            </Link>
          ),
        })}
      </p>
      <h2>{t('returnsRefundsTitle')}</h2>
      <p>{t('returnsRefundsBody')}</p>
      <h2>{t('returnsDamagedTitle')}</h2>
      <p>
        {rich(t('returnsDamagedBody'), {
          contact: (c) => (
            <Link key="contact" href="/help/contact?topic=RETURN">
              {c}
            </Link>
          ),
        })}
      </p>
    </LegalPage>
  );
}
