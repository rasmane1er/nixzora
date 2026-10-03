import { type ProductCard as Card } from '@nixzora/validation';
import type { Metadata } from 'next';
import { ProductCard } from '@/components/ProductCard';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { removeWish } from './actions';

export const metadata: Metadata = { title: 'Wishlist', robots: { index: false } };

export default async function WishlistPage() {
  const items = await accountApi<Card[]>('/me/wishlist', '/account/wishlist');
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title="Your wishlist"
        description={`${items.length} saved ${items.length === 1 ? 'item' : 'items'}.`}
      />
      {items.length === 0 ? (
        <div className="empty card">
          <p>Nothing saved yet. Tap “Save” on any product to keep it here.</p>
        </div>
      ) : (
        <div className="grid">
          {items.map((product) => (
            <div key={product.id} className="stack" style={{ gap: 6 }}>
              <ProductCard product={product} />
              <form action={removeWish}>
                <input type="hidden" name="productId" value={product.id} />
                <button className="btn btn--link" type="submit">
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
