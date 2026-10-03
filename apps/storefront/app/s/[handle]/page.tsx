import { type PagedResult, type ProductCard as Card, type PublicSeller } from '@nixzora/validation';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';
import { api, ApiError } from '@/lib/api';

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function loadStore(handle: string): Promise<PublicSeller> {
  if (!HANDLE.test(handle)) notFound();
  try {
    return await api<PublicSeller>(`/catalog/sellers/${handle}`, { auth: false, revalidate: 60 });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const store = await loadStore((await params).handle);
  return {
    title: `${store.displayName} on NIXZORA`,
    description: store.description ?? `Shop ${store.displayName} on NIXZORA.`,
  };
}

export default async function StorePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const store = await loadStore(handle);
  const products = await api<PagedResult<Card>>(
    `/catalog/products?seller=${handle}&pageSize=48&sort=newest`,
    { auth: false, revalidate: 30 },
  );
  const since = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(store.memberSince),
  );

  return (
    <div className="wrap section stack" style={{ gap: 24 }}>
      <header className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">Marketplace seller</p>
        <h1>{store.displayName}</h1>
        <p className="muted">
          Selling on NIXZORA since {since} · {store.productCount}{' '}
          {store.productCount === 1 ? 'product' : 'products'}
        </p>
        {store.description ? <p style={{ maxWidth: 680 }}>{store.description}</p> : null}
        <p className="muted" style={{ fontSize: 14 }}>
          Orders are covered by NIXZORA&apos;s secure checkout and 30-day returns.
        </p>
      </header>
      {products.items.length ? (
        <div className="grid">
          {products.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty card">
          <p>No products listed right now.</p>
        </div>
      )}
    </div>
  );
}
