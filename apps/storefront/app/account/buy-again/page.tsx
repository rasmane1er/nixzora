import { type BuyAgainItem } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { BuyAgainCard } from '@/components/AccountOrderCard';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('accountActivity');
  return { title: t('buyAgainTitle'), robots: { index: false } };
}

export default async function BuyAgainPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [items, t] = await Promise.all([
    accountApi<BuyAgainItem[]>('/me/buy-again', '/account/buy-again'),
    getT('accountActivity'),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader title={t('buyAgainTitle')} description={t('buyAgainDescription')} />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      {items.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            {t('buyAgainEmpty')} <Link href="/search">{t('startShopping')}</Link>
          </p>
        </div>
      ) : (
        <div className="buy-again-grid">
          {items.map((item) => (
            <BuyAgainCard key={item.productId} item={item} back="/account/buy-again" />
          ))}
        </div>
      )}
    </div>
  );
}
