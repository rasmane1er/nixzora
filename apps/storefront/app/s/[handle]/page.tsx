import {
  type PagedResult,
  type ProductCard as Card,
  type PublicSeller,
  SELLER_CATEGORY_LABEL,
  type SellerCategory,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';
import { SellerRating } from '@/components/SellerRating';
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
      <header className="store-hero">
        <div
          className="store-hero__banner"
          style={
            store.bannerUrl
              ? { backgroundImage: `url(${JSON.stringify(store.bannerUrl)})` }
              : undefined
          }
          aria-hidden="true"
        />
        <div className="store-hero__body">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded logo
            <img className="store-hero__logo" src={store.logoUrl} alt="" width={88} height={88} />
          ) : (
            <span className="store-hero__logo store-hero__logo--initial" aria-hidden="true">
              {store.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="stack" style={{ gap: 6, minWidth: 0 }}>
            <p className="eyebrow">
              Marketplace seller
              {store.category
                ? ` · ${SELLER_CATEGORY_LABEL[store.category as SellerCategory] ?? ''}`
                : ''}
            </p>
            <h1>{store.displayName}</h1>
            <ul className="store-hero__stats">
              <li>
                <SellerRating rating={store.rating} />
              </li>
              <li>
                {store.salesCount.toLocaleString('en-US')}{' '}
                {store.salesCount === 1 ? 'sale' : 'sales'}
              </li>
              <li>
                {store.productCount} {store.productCount === 1 ? 'product' : 'products'}
              </li>
              <li>Since {since}</li>
              <li>
                Ships in {store.handlingDays} business {store.handlingDays === 1 ? 'day' : 'days'}
              </li>
            </ul>
          </div>
        </div>
        {store.description ? <p style={{ maxWidth: 680, margin: 0 }}>{store.description}</p> : null}
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          Orders are covered by NIXZORA&apos;s secure checkout and 30-day returns.
          {store.supportEmail ? (
            <>
              {' '}
              Questions? <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a>
            </>
          ) : null}
          {store.website ? (
            <>
              {' '}
              ·{' '}
              <a href={store.website} rel="nofollow noopener" target="_blank">
                Website
              </a>
            </>
          ) : null}
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
