import { type FollowingFeed } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { ProductCard } from '@/components/ProductCard';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';
import { FollowButton } from '../s/[handle]/FollowButton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('follows');
  return { title: t('metaTitle'), robots: { index: false } };
}

/** Following (p10-24): deals and new listings from the stores you follow, and the stores. */
export default async function FollowingPage() {
  const [feed, t] = await Promise.all([
    accountApi<FollowingFeed>('/me/following', '/following'),
    getT('follows'),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 24 }}>
      <AccountHeader title={t('title')} description={t('lead')} />
      {!feed.stores.length ? (
        <div className="card">
          <p style={{ margin: 0 }}>{t('none')}</p>
        </div>
      ) : (
        <>
          <section className="stack" style={{ gap: 12 }} aria-labelledby="following-deals">
            <h2 id="following-deals">{t('dealsTitle')}</h2>
            {feed.deals.length ? (
              <div className="grid">
                {feed.deals.map((product) => (
                  <div key={product.id} className="following-card">
                    <ProductCard product={product} />
                    <Link
                      className="muted following-card__store"
                      href={`/s/${product.store.handle}`}
                    >
                      {t('from', { store: product.store.displayName })}
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{t('noDeals')}</p>
            )}
          </section>
          <section className="stack" style={{ gap: 12 }} aria-labelledby="following-new">
            <h2 id="following-new">{t('newTitle')}</h2>
            {feed.newArrivals.length ? (
              <div className="grid">
                {feed.newArrivals.map((product) => (
                  <div key={product.id} className="following-card">
                    <ProductCard product={product} />
                    <Link
                      className="muted following-card__store"
                      href={`/s/${product.store.handle}`}
                    >
                      {t('from', { store: product.store.displayName })}
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{t('noNew')}</p>
            )}
          </section>
          <section className="stack" style={{ gap: 12 }} aria-labelledby="following-stores">
            <h2 id="following-stores">{t('storesTitle')}</h2>
            <ul className="followed-stores">
              {feed.stores.map((store) => (
                <li key={store.handle} className="card followed-store">
                  {store.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded logo
                    <img
                      src={store.logoUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="followed-store__logo"
                    />
                  ) : (
                    <span
                      className="followed-store__logo followed-store__logo--initial"
                      aria-hidden="true"
                    >
                      {store.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="followed-store__body">
                    <Link href={`/s/${store.handle}`} style={{ fontWeight: 600 }}>
                      {store.displayName}
                    </Link>
                    {store.newCount ? (
                      <span className="muted">{t('newCount', { count: store.newCount })}</span>
                    ) : null}
                    <FollowButton
                      handle={store.handle}
                      store={store.displayName}
                      signedIn
                      initial={{ following: true, notify: store.notify, followers: 0 }}
                      hideCount
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
