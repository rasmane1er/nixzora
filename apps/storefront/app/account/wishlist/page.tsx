import { type ProductCard as Card } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { api } from '@/lib/api';
import { removeWish } from './actions';

export const metadata: Metadata = { title: 'Wishlist', robots: { index: false } };

export default async function WishlistPage() {
  const items = await api<Card[]>('/me/wishlist');
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">
          <Link href="/account">Your account</Link>
        </p>
        <h1>Wishlist</h1>
      </div>
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
