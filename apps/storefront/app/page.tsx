import Link from 'next/link';
import { smartRowTitle } from '@nixzora/i18n';
import {
  type DealsPage,
  departmentLookup,
  type ProductCard as Card,
  quadsByCategory,
  type Recommendations,
  rowShapes,
  spotlightDeal,
} from '@nixzora/validation';
import { ProductCard } from '@/components/ProductCard';
import { ProductRail } from '@/components/ProductRail';
import {
  AskCard,
  BuyAgain,
  DealTiles,
  dealQuadItems,
  KeepShopping,
  PriceDropCard,
  PriceTiles,
  QuadCard,
  RowCards,
  SpotlightDeal,
} from '@/components/ShapeCards';
import { sponsored } from '@/lib/ads';
import { api, catalog } from '@/lib/api';
import { countProducts } from '@/lib/categories';
import { departmentImage } from '@/lib/departments';
import { departmentName, getT } from '@/lib/i18n';
import { visitorId } from '@/lib/visitor';

/** The server's clock for this render (which deal ends soonest). */
const renderedAt = () => Date.now();

export default async function HomePage() {
  const visitor = await visitorId();
  const [categories, newest, picks, ads, deals] = await Promise.all([
    catalog.categories().catch(() => []),
    catalog.products('?sort=newest&pageSize=12&inStock=true').catch(() => null),
    // With the guest cart id, so "Goes with your cart" works before sign-in.
    api<Recommendations>(
      `/recommendations${visitor ? `?visitorId=${encodeURIComponent(visitor)}` : ''}`,
      { cart: true },
    ).catch(() => null),
    sponsored({ placement: 'home' }),
    api<DealsPage>('/catalog/deals', { revalidate: 30 }).catch(() => null),
  ]);
  const [t, p, a, d, tc, names] = await Promise.all([
    getT('home'),
    getT('product'),
    getT('ads'),
    getT('deals'),
    getT('cards'),
    Promise.all(categories.map((category) => departmentName(category))),
  ]);
  const prompts = [t('prompt1'), t('prompt2'), t('prompt3'), t('prompt4')];
  // Featured: what shoppers like right now (or, for a returning visitor, picks for them).
  const featured = (picks?.products.length ? picks.products : (newest?.items ?? [])).slice(0, 8);
  const featuredTitle = picks?.basis === 'history' ? t('recommended') : t('featured');
  const featuredIds = new Set(featured.map((product) => product.id));
  const newArrivals = (newest?.items ?? []).filter((product) => !featuredIds.has(product.id));

  // Card shapes (ADR-0061): each section gets its own shape, so the page never repeats itself.
  const live = deals?.live ?? [];
  const spotlight = spotlightDeal(live, renderedAt());
  const otherDeals = live.filter((product) => product.id !== spotlight?.id);
  const groupOf = departmentLookup(categories);
  const dealQuads = quadsByCategory(live, 2, groupOf);
  const newQuads = quadsByCategory(newest?.items ?? [], 2, groupOf);
  const shaped = rowShapes(picks?.rows ?? []);
  const shape = (kind: string) => shaped.find((s) => s.shape === kind)?.row;
  const keep = shape('quad');
  const ask = shape('ask');
  const drop = shape('priceDrop');
  const again = shape('buyAgain');
  const dropProduct = drop?.products.find((product) => drop.details?.[product.id]?.wasCents);
  // Fastest to arrive first, for the row cards.
  const soonest = [
    ...new Map([...featured, ...newArrivals].map((item) => [item.id, item])).values(),
  ]
    .filter((product): product is Card & { delivery: { latest: string } } =>
      Boolean(product.inStock && product.delivery && product.defaultVariantId),
    )
    .sort((x, y) => x.delivery.latest.localeCompare(y.delivery.latest))
    .slice(0, 3);

  return (
    <div className="wrap">
      <section className="hero" aria-labelledby="hero-title">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative, sized by CSS */}
        <img
          className="hero__art hero__art--home"
          src="/home/hero-home.webp"
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
          <ul className="dept-circles">
            {categories.map((category, i) => {
              const image = departmentImage(category.slug);
              return (
                <li key={category.id}>
                  <Link href={`/c/${category.slug}`} className="dept-circle">
                    <span className="dept-circle__photo">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small decorative art
                        <img src={image} alt="" width={84} height={84} loading="lazy" />
                      ) : null}
                    </span>
                    <span className="dept-circle__name">{names[i]}</span>
                    <span className="sr-only">
                      {p('products', { count: countProducts(category) })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="card-wall">
        {keep ? <KeepShopping row={keep} /> : null}
        {await Promise.all(
          (dealQuads.length
            ? dealQuads
            : live.length >= 2
              ? [{ category: null, products: live.slice(0, 4) }]
              : []
          ).map(async (quad, i) => (
            <QuadCard
              key={quad.category?.slug ?? 'deals'}
              id={`deal-quad-${i}`}
              title={
                quad.category
                  ? tc('dealsIn', { category: await departmentName(quad.category) })
                  : d('railTitle')
              }
              items={await dealQuadItems(quad.products)}
              link={{ href: '/deals', label: tc('seeAllDeals') }}
            />
          )),
        )}
        {ask ? (
          <AskCard subject={ask.subject ?? ''} source={ask.source} products={ask.products} />
        ) : (
          <AskCard subject={prompts[0]!} source={null} />
        )}
        {dropProduct || again ? (
          <div className="card-wall__stack">
            {dropProduct ? (
              <PriceDropCard
                product={dropProduct}
                wasCents={drop!.details![dropProduct.id]!.wasCents!}
              />
            ) : null}
            {again ? <BuyAgain row={again} /> : null}
          </div>
        ) : null}
        {await Promise.all(
          newQuads.map(async (quad) => {
            const name = await departmentName(quad.category);
            return (
              <QuadCard
                key={quad.category.slug}
                id={`new-quad-${quad.category.slug}`}
                title={tc('newIn', { category: name })}
                items={quad.products.map((product) => ({
                  href: `/p/${product.slug}`,
                  product,
                  label: product.title,
                }))}
                link={{
                  href: `/c/${quad.category.slug}`,
                  label: tc('shopCategory', { category: name }),
                }}
              />
            );
          }),
        )}
      </div>

      {spotlight ? (
        <div className="section spotlight-row">
          <SpotlightDeal product={spotlight} />
        </div>
      ) : null}
      <DealTiles
        id="deals"
        title={d('railTitle')}
        products={otherDeals.slice(0, 12)}
        link={{ href: '/deals', label: d('seeAll') }}
      />

      {shaped
        .filter((s) => s.shape === 'rail')
        .map(({ row }, i) => (
          <ProductRail
            key={`${row.kind}-${i}`}
            id={`picks-${i}`}
            title={smartRowTitle(row, a)}
            products={row.products}
          />
        ))}

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

      {soonest.length ? (
        <div className="section">
          <RowCards id="soonest" title={tc('arrivesSoonest')} products={soonest} />
        </div>
      ) : null}

      <PriceTiles id="sponsored" title={a('sponsoredHome')} sponsored={ads} />

      {picks ? (
        <PriceTiles id="recent" title={t('recentlyViewed')} products={picks.recentlyViewed} />
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
