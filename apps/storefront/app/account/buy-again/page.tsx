import { type BuyAgainItem } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { BuyAgainCard } from '@/components/AccountOrderCard';
import { accountApi } from '@/lib/account';
import { param, type SearchParams } from '@/lib/params';

export const metadata: Metadata = { title: 'Buy again', robots: { index: false } };

export default async function BuyAgainPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const items = await accountApi<BuyAgainItem[]>('/me/buy-again', '/account/buy-again');
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title="Buy again"
        description="Products from your past orders that are still for sale, most recent first."
      />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      {items.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            Products you have received show up here. <Link href="/search">Start shopping →</Link>
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
