import {
  type FollowStatus,
  type PagedResult,
  type ProductCard as Card,
  type PublicSeller,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';
import { SellerRating } from '@/components/SellerRating';
import { api, ApiError } from '@/lib/api';
import { calendarDay } from '@nixzora/i18n';
import { departmentName, getFormat, getLocale, getT } from '@/lib/i18n';
import { isSignedIn } from '@/lib/session';
import { FollowButton } from './FollowButton';

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
  const t = await getT('store');
  return {
    title: t('metaTitle', { name: store.displayName }),
    description: store.description ?? t('metaDescription', { name: store.displayName }),
  };
}

export default async function StorePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const store = await loadStore(handle);
  const products = await api<PagedResult<Card>>(
    `/catalog/products?seller=${handle}&pageSize=48&sort=newest`,
    { auth: false, revalidate: 30 },
  );
  const t = await getT('store');
  const p = await getT('product');
  const vac = await getT('vacation');
  const locale = await getLocale();
  // Follow stores (p10-24): whether the viewer follows it, and how many people do.
  const signedIn = await isSignedIn();
  const follow = await api<FollowStatus>(`/catalog/sellers/${handle}/follow`).catch(
    (): FollowStatus => ({ following: false, notify: false, followers: store.followers ?? 0 }),
  );
  const f = await getFormat();
  const since = f.monthYear(store.memberSince);
  const categoryName = store.category
    ? await departmentName({ slug: store.category, name: store.category })
    : '';

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
              {t('marketplaceSeller')}
              {store.category ? ` · ${categoryName}` : ''}
            </p>
            <h1>{store.displayName}</h1>
            <FollowButton
              handle={store.handle}
              store={store.displayName}
              signedIn={signedIn}
              initial={follow}
            />
            <ul className="store-hero__stats">
              <li>
                <SellerRating rating={store.rating} />
              </li>
              <li>{t('sales', { count: store.salesCount })}</li>
              <li>{p('products', { count: store.productCount })}</li>
              <li>{t('since', { date: since })}</li>
              <li>{t('shipsIn', { count: store.handlingDays })}</li>
            </ul>
          </div>
        </div>
        {store.description ? <p style={{ maxWidth: 680, margin: 0 }}>{store.description}</p> : null}
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          {t('covered')}
          {store.supportEmail ? (
            <>
              {' '}
              {t('questions')} <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a>
            </>
          ) : null}
          {store.website ? (
            <>
              {' '}
              ·{' '}
              <a href={store.website} rel="nofollow noopener" target="_blank">
                {t('website')}
              </a>
            </>
          ) : null}
        </p>
      </header>
      {store.away ? (
        // Vacation mode (p10-32).
        <div className="banner banner--info" role="status" style={{ marginBottom: 20 }}>
          <p>
            {store.away.until
              ? vac('storeBanner', { date: calendarDay(store.away.until, locale) })
              : vac('storeBannerOpen')}
          </p>
          {store.away.message ? (
            <p className="muted">{vac('note', { message: store.away.message })}</p>
          ) : null}
        </div>
      ) : null}
      {products.items.length ? (
        <div className="grid">
          {products.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty card">
          <p>{t('noProducts')}</p>
        </div>
      )}
    </div>
  );
}
