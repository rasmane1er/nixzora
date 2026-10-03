import { type ProductCard as Card } from '@nixzora/validation';
import type { Metadata } from 'next';
import { ProductCard } from '@/components/ProductCard';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';
import { removeWish } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('accountActivity');
  return { title: t('wishlistMetaTitle'), robots: { index: false } };
}

export default async function WishlistPage() {
  const [items, t, tc] = await Promise.all([
    accountApi<Card[]>('/me/wishlist', '/account/wishlist'),
    getT('accountActivity'),
    getT('common'),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title={t('wishlistTitle')}
        description={t('wishlistCount', { count: items.length })}
      />
      {items.length === 0 ? (
        <div className="empty card">
          <p>{t('wishlistEmpty')}</p>
        </div>
      ) : (
        <div className="grid">
          {items.map((product) => (
            <div key={product.id} className="stack" style={{ gap: 6 }}>
              <ProductCard product={product} />
              <form action={removeWish}>
                <input type="hidden" name="productId" value={product.id} />
                <button className="btn btn--link" type="submit">
                  {tc('remove')}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
