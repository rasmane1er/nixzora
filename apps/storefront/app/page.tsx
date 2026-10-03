import Link from 'next/link';
import { type Recommendations } from '@nixzora/validation';
import { ProductCard } from '@/components/ProductCard';
import { ProductRail } from '@/components/ProductRail';
import { api, catalog } from '@/lib/api';
import { countProducts } from '@/lib/categories';
import { departmentImage } from '@/lib/departments';
import { departmentName, getT } from '@/lib/i18n';
import { visitorId } from '@/lib/visitor';

export default async function HomePage() {
  const visitor = await visitorId();
  const [categories, newest, picks] = await Promise.all([
    catalog.categories().catch(() => []),
    catalog.products('?sort=newest&pageSize=8&inStock=true').catch(() => null),
    api<Recommendations>(
      `/recommendations${visitor ? `?visitorId=${encodeURIComponent(visitor)}` : ''}`,
    ).catch(() => null),
  ]);
  const t = await getT('home');
  const p = await getT('product');
  const prompts = [t('prompt1'), t('prompt2'), t('prompt3'), t('prompt4')];
  const names = await Promise.all(categories.map((category) => departmentName(category)));
  // Featured: what shoppers like right now (or, for a returning visitor, picks for them).
  const featured = (picks?.products.length ? picks.products : (newest?.items ?? [])).slice(0, 8);
  const featuredTitle = picks?.basis === 'history' ? t('recommended') : t('featured');
  const featuredIds = new Set(featured.map((product) => product.id));
  const newArrivals = (newest?.items ?? []).filter((product) => !featuredIds.has(product.id));

  return (
    <div className="wrap">
      <section className="hero" aria-labelledby="hero-title">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative, sized by CSS */}
        <img
          className="hero__art"
          src="/home/hero-desk.webp"
          alt={t('heroImageAlt')}
          width={1600}
          height={900}
          fetchPriority="high"
        />
        <div className="hero__content">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 id="hero-title">{t('title')}</h1>
          <p>{t('lead')}</p>
          <form action="/assistant" className="hero__ask" role="search">
            <input
              name="q"
              type="search"
              placeholder={t('askPlaceholder')}
              aria-label={t('askLabel')}
            />
            <button className="btn btn--primary" type="submit">
              {t('findIt')}
            </button>
          </form>
          <div className="hero__chips" aria-label={t('tryThese')}>
            {prompts.map((prompt) => (
              <Link key={prompt} href={`/assistant?q=${encodeURIComponent(prompt)}`}>
                {prompt}
              </Link>
            ))}
          </div>
        </div>
        <div className="hero__badge">
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
            <path
              d="M2.25 6.75h11.25v9.75H2.25V6.75Zm11.25 3h4.5l3.75 3.75v3h-8.25M6.75 18.75a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            <strong>{t('deliveryTitle')}</strong>
            <span>{t('deliveryBody')}</span>
          </span>
        </div>
      </section>

      {categories.length ? (
        <section className="section" aria-labelledby="shop-by">
          <div className="section-head">
            <h2 id="shop-by">{t('shopByDepartment')}</h2>
            <Link className="section-link" href="/search">
              {t('viewAll')} →
            </Link>
          </div>
          <div className="dept-tiles">
            {categories.map((category, i) => {
              const image = departmentImage(category.slug);
              return (
                <Link key={category.id} href={`/c/${category.slug}`} className="dept-tile">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small decorative art
                    <img src={image} alt="" width={72} height={54} loading="lazy" />
                  ) : (
                    <span className="dept-tile__blank" aria-hidden="true" />
                  )}
                  <span className="dept-tile__text">
                    <strong>{names[i]}</strong>
                    <span className="muted">
                      {p('products', { count: countProducts(category) })}
                    </span>
                  </span>
                  <span className="dept-tile__chevron" aria-hidden="true">
                    ›
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {featured.length ? (
        <section className="section" aria-labelledby="featured">
          <div className="section-head">
            <h2 id="featured">{featuredTitle}</h2>
            <Link className="section-link" href="/search">
              {t('viewAllFeatured')} →
            </Link>
          </div>
          <div className="grid grid--featured">
            {featured.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>
        </section>
      ) : null}

      {picks ? (
        <ProductRail id="recent" title={t('recentlyViewed')} products={picks.recentlyViewed} />
      ) : null}

      {newArrivals.length ? (
        <section className="section" aria-labelledby="new">
          <div className="section-head">
            <h2 id="new">{t('newInStock')}</h2>
            <Link className="section-link" href="/search?sort=newest">
              {t('seeAll')}
            </Link>
          </div>
          <div className="grid">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="section promises" aria-label={t('whyNixzora')}>
        <div className="promise">
          <h3>{t('specsTitle')}</h3>
          <p className="muted">{t('specsBody')}</p>
        </div>
        <div className="promise">
          <h3>{t('shippingTitle')}</h3>
          <p className="muted">{t('shippingBody')}</p>
        </div>
        <div className="promise">
          <h3>{t('secureTitle')}</h3>
          <p className="muted">{t('secureBody')}</p>
        </div>
      </section>
    </div>
  );
}
