import Link from 'next/link';
import { type Recommendations } from '@nixzora/validation';
import { ProductCard } from '@/components/ProductCard';
import { ProductRail } from '@/components/ProductRail';
import { api, catalog } from '@/lib/api';
import { visitorId } from '@/lib/visitor';
import { countProducts } from '@/lib/categories';
import { departmentName, getT } from '@/lib/i18n';

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

  return (
    <div className="wrap">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__dot" />
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
      </section>

      {categories.length ? (
        <section className="section" aria-labelledby="shop-by">
          <div className="section-head">
            <h2 id="shop-by">{t('shopByDepartment')}</h2>
          </div>
          <div className="tiles">
            {categories.map((category, i) => (
              <Link key={category.id} href={`/c/${category.slug}`} className="tile">
                <strong>{names[i]}</strong>
                <span className="muted">{p('products', { count: countProducts(category) })}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {picks ? (
        <>
          <ProductRail
            id="for-you"
            title={picks.basis === 'history' ? t('recommended') : t('popular')}
            products={picks.products}
          />
          <ProductRail id="recent" title={t('recentlyViewed')} products={picks.recentlyViewed} />
        </>
      ) : null}

      {newest?.items.length ? (
        <section className="section" aria-labelledby="new">
          <div className="section-head">
            <h2 id="new">{t('newInStock')}</h2>
            <Link href="/search?sort=newest">{t('seeAll')}</Link>
          </div>
          <div className="grid">
            {newest.items.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
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
