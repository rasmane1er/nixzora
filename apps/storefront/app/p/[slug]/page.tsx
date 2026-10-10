import {
  type BundleView,
  type MyPlus,
  PRICE_HISTORY_RANGES,
  type ProductAlertRef,
  type QuestionPage,
  type ProductDetail,
  type RelatedProducts,
  type ReviewInsights as Insights,
  type ReviewPage,
  twoDayWindow,
} from '@nixzora/validation';
import { cardBrand, INTL_LOCALE, rich, specLabel as sharedSpecLabel } from '@nixzora/i18n';
import { Price } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeliveryPromise } from '@/components/DeliveryPromise';
import { ProductRail } from '@/components/ProductRail';
import { sponsored } from '@/lib/ads';
import { SellerRating } from '@/components/SellerRating';
import { ReviewInsights } from '@/components/ReviewInsights';
import { Stars } from '@/components/Stars';
import { api, ApiError, catalog } from '@/lib/api';
import { cspNonce } from '@/lib/csp-nonce';
import { departmentName, getFormat, getLocale, getT } from '@/lib/i18n';
import { oneClickSetup } from '@/lib/one-click';
import { isSignedIn } from '@/lib/session';
import { SITE_URL } from '@/lib/params';
import { DealTimer } from '@/components/DealTimer';
import { AddToCart } from './AddToCart';
import { AddToList } from './AddToList';
import { CompareButton } from '@/components/CompareButton';
import { Gallery } from './Gallery';
import { ReviewForm } from './ReviewForm';
import { BoughtTogether } from './BoughtTogether';
import { BundleOffer } from './BundleOffer';
import { LowestPriceBadge, PriceHistorySection } from './PriceHistorySection';
import { ClipButton } from '@/components/ClipButton';
import { clippedCouponIds, couponLabel } from '@/lib/coupons';
import { Questions } from './Questions';
import { ReviewList } from './ReviewList';
import { StockAlert } from './StockAlert';
import { ViewTracker } from './ViewTracker';
import { WishButton } from './WishButton';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ph?: string | string[] }>;
};

async function load(slug: string): Promise<ProductDetail> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();
  try {
    return await catalog.product(slug);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await load(slug);
  const description = product.description.slice(0, 155);
  return {
    title: product.title,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      images: product.images[0] ? [{ url: product.images[0].url, alt: product.images[0].alt }] : [],
    },
  };
}

/** The server's clock for this render (the deal countdown starts from it). */
const renderedAt = () => Date.now();

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  // Price history range (p10-19): ?ph=30|90|365, 90 days unless asked.
  const phRaw = Number((await searchParams).ph);
  const ph = (PRICE_HISTORY_RANGES as readonly number[]).includes(phRaw) ? phRaw : 90;
  const product = await load(slug);
  const signedIn = await isSignedIn();
  // NIXZORA Plus (p10-15): members see their 2-day promise; everyone else, the offer.
  const member = signedIn
    ? await api<MyPlus>('/me/plus')
        .then((mine) => Boolean(mine.membership?.active))
        .catch(() => false)
    : false;
  const inStock = product.variants.some((v) => v.isActive && v.available > 0);
  // Bundle & save (p10-16): bundles this product is in.
  const bundleOffers = await api<BundleView[]>(`/catalog/products/${slug}/bundles`, {
    auth: false,
    revalidate: 60,
  }).catch((): BundleView[] => []);
  const [reviews, wishIds, myReview, related, insights, ads, questions, alerts] = await Promise.all(
    [
      api<ReviewPage>(`/catalog/products/${slug}/reviews`, { auth: false, revalidate: 30 }).catch(
        () => null,
      ),
      signedIn
        ? api<string[]>('/me/wishlist/ids').catch((): string[] => [])
        : Promise.resolve<string[]>([]),
      signedIn
        ? api<{
            review: { rating: number; title: string; body: string; status: string } | null;
            canReview: boolean;
            helpfulVotes?: string[];
          }>(`/catalog/products/${slug}/reviews/mine`).catch(() => null)
        : Promise.resolve(null),
      api<RelatedProducts>(`/catalog/products/${slug}/related`, {
        auth: false,
        revalidate: 300,
      }).catch((): RelatedProducts => ({ similar: [], boughtTogether: [], alsoViewed: [] })),
      // Cached reads carry no Accept-Language: the language is in the URL, one cache entry each.
      api<{ insights: Insights | null }>(
        `/catalog/products/${slug}/reviews/insights?lang=${await getLocale()}`,
        { auth: false, revalidate: 300 },
      )
        .then((res) => res.insights)
        .catch(() => null),
      sponsored({ placement: 'product', product: slug }),
      // Signed in: so the page knows whether this shopper may answer.
      api<QuestionPage>(`/catalog/products/${slug}/questions`).catch((): QuestionPage => ({
        questions: [],
        page: 1,
        totalPages: 1,
        total: 0,
        canAnswer: false,
      })),
      signedIn && !inStock
        ? api<ProductAlertRef[]>('/me/alerts').catch((): ProductAlertRef[] => [])
        : Promise.resolve<ProductAlertRef[]>([]),
    ],
  );
  const specs = Object.entries(product.attributes);
  const t = await getT('productPage');
  const d = await getT('deals');
  const pl = await getT('plus');
  const cl = await getT('clips');
  const w = await getT('wallet');
  const ib = await getT('inbox');
  const cmp = await getT('compare');
  // 1-click (p10-09): only when a saved card and an address are ready.
  const oneClick = signedIn && inStock ? await oneClickSetup() : null;
  const a = await getT('ads');
  const p = await getT('product');
  const c = await getT('common');
  const f = await getFormat();
  const locale = await getLocale();
  /** A spec's name in the visitor's language (shared with the app). */
  const specLabel = (key: string) => sharedSpecLabel(key, locale);
  const crumbNames = await Promise.all(product.breadcrumb.map((crumb) => departmentName(crumb)));
  const categoryName = await departmentName(product.category);

  // Structured data so search engines can show price and availability.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    sku: product.variants[0]?.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    image: product.images.map((image) => image.url),
    aggregateRating: product.rating.count
      ? {
          '@type': 'AggregateRating',
          ratingValue: product.rating.average,
          reviewCount: product.rating.count,
        }
      : undefined,
    offers: product.variants
      .filter((variant) => variant.isActive)
      .map((variant) => ({
        '@type': 'Offer',
        sku: variant.sku,
        price: (variant.priceCents / 100).toFixed(2),
        priceCurrency: variant.currency,
        availability:
          variant.available > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: `${SITE_URL}/p/${product.slug}`,
      })),
  };

  return (
    <div className="wrap section">
      <script
        type="application/ld+json"
        nonce={await cspNonce()}
        // JSON.stringify output with "<" escaped cannot break out of the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <ol className="breadcrumb">
        <li>
          <Link href="/">{t('home')}</Link>
        </li>
        {product.breadcrumb.map((crumb, i) => (
          <li key={crumb.slug}>
            <Link href={`/c/${crumb.slug}`}>{crumbNames[i]}</Link>
          </li>
        ))}
      </ol>

      <div className="pdp">
        <Gallery
          photos={product.images.map(({ id, url, alt }) => ({ id, url, alt }))}
          fallback={categoryName}
        />

        <div className="buybox">
          <div className="stack" style={{ gap: 8 }}>
            {product.brand ? (
              <span className="product-card__brand">{product.brand.name}</span>
            ) : null}
            <h1>{product.title}</h1>
            {product.rating.count ? (
              <a href="#reviews" className="rating-line">
                <Stars value={product.rating.average ?? 0} />
                <span>
                  {f.number(product.rating.average ?? 0)} ·{' '}
                  {t('reviewCount', { count: product.rating.count })}
                </span>
              </a>
            ) : null}
            {product.boughtPastMonth ? (
              <span className="card-bought">
                {p('boughtPastMonth', {
                  count: new Intl.NumberFormat(INTL_LOCALE[locale], {
                    notation: 'compact',
                  }).format(product.boughtPastMonth),
                })}
              </span>
            ) : null}
            <Price
              cents={product.priceFromCents}
              compareAtCents={product.compareAtCents}
              currency={product.currency}
              prefix={product.variants.length > 1 ? p('from') : undefined}
              locale={INTL_LOCALE[locale]}
              wasLabel={p('was')}
            />
            <LowestPriceBadge slug={product.slug} />
          </div>
          {product.deal ? (
            <div className="pdp-deal">
              <span
                className={`card-badge card-badge--${product.deal.plusOnly ? 'plus' : 'deal'} pdp-deal__badge`}
              >
                {product.deal.plusOnly
                  ? pl('plusPrice')
                  : d(product.deal.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')}{' '}
                · {d('percentOff', { percent: f.percent(product.deal.percentOff / 100) })}
              </span>
              {product.deal.plusOnly ? (
                <span className="plus-price">
                  {pl('memberPrice', {
                    price: f.money(
                      Math.max(
                        1,
                        Math.round(
                          (product.priceFromCents * (100 - product.deal.percentOff)) / 100,
                        ),
                      ),
                    ),
                  })}
                </span>
              ) : null}
              <DealTimer
                endsAt={product.deal.endsAt}
                claimedPercent={
                  product.deal.kind === 'LIGHTNING' ? product.deal.claimedPercent : null
                }
                initialNow={renderedAt()}
              />
            </div>
          ) : null}
          {product.coupon ? (
            <ClipButton
              couponId={product.coupon.id}
              label={couponLabel(product.coupon, cl, f)}
              initial={(await clippedCouponIds()).has(product.coupon.id)}
            />
          ) : null}
          <DeliveryPromise
            window={member && !product.seller ? twoDayWindow(new Date()) : product.delivery}
            twoDay={member && !product.seller}
          />
          {product.seller ? null : (
            // NIXZORA ships it: Plus members get it in 2 days, free (p10-15).
            <p className="plus-note">
              <span className="plus-chip">{pl('badge')}</span> {pl('twoDayWithPlus')}
              {member ? null : (
                <>
                  {' '}
                  <Link href="/plus">{pl('upsellCta')}</Link>
                </>
              )}
            </p>
          )}
          <AddToCart
            variants={product.variants}
            slug={product.slug}
            subscribe={product.subscribable ? { signedIn, ready: Boolean(oneClick) } : null}
            oneClick={
              oneClick
                ? {
                    shipTo: `${oneClick.address.fullName}, ${oneClick.address.city}`,
                    card: w('cardLabel', {
                      brand: cardBrand(oneClick.card.brand),
                      last4: oneClick.card.last4,
                    }),
                  }
                : null
            }
          />
          {!inStock ? (
            <StockAlert
              productId={product.id}
              slug={product.slug}
              signedIn={signedIn}
              initial={alerts.some((x) => x.productId === product.id && x.kind === 'BACK_IN_STOCK')}
            />
          ) : null}
          <div className="pdp-save">
            <WishButton
              productId={product.id}
              slug={product.slug}
              initial={wishIds.includes(product.id)}
            />
            <AddToList productId={product.id} slug={product.slug} />
            <CompareButton slug={product.slug} />
          </div>
          <p className="sold-by">
            {t('soldBy')}{' '}
            {product.seller ? (
              <>
                <Link href={`/s/${product.seller.handle}`}>{product.seller.displayName}</Link>{' '}
                <SellerRating rating={product.seller.rating} />
                {' · '}
                <Link
                  href={`/account/messages/new?store=${product.seller.handle}&product=${product.id}`}
                >
                  {ib('askStore')}
                </Link>
              </>
            ) : (
              <strong>NIXZORA</strong>
            )}
          </p>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            <li>{t('perkShipping')}</li>
            <li>{t('perkReturns')}</li>
            <li>{t('perkSecure')}</li>
          </ul>
        </div>
      </div>

      <div className="two section">
        <section className="stack" aria-labelledby="about">
          <h2 id="about">{t('aboutProduct')}</h2>
          <p className="description">{product.description}</p>
        </section>
        {specs.length ? (
          <section className="stack" aria-labelledby="specs">
            <h2 id="specs">{t('specifications')}</h2>
            <table className="specs">
              <tbody>
                {specs.map(([key, value]) => (
                  <tr key={key}>
                    <th scope="row">{specLabel(key)}</th>
                    <td>
                      {typeof value === 'boolean' ? (value ? c('yes') : c('no')) : String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
      <section id="reviews" className="section stack" aria-labelledby="reviews-title">
        <h2 id="reviews-title">{t('customerReviews')}</h2>
        {insights ? <ReviewInsights insights={insights} /> : null}
        <div className="reviews">
          <div className="stack">
            {reviews?.summary.count ? (
              <>
                <div className="rating-line" style={{ fontSize: 18 }}>
                  <Stars value={reviews.summary.average ?? 0} size={22} />
                  <strong>
                    {t('outOfFive', { rating: f.number(reviews.summary.average ?? 0) })}
                  </strong>
                </div>
                <div className="histogram" aria-label={t('ratingsBreakdown')}>
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star}>
                      <span>{t('starRow', { count: star })}</span>
                      <meter
                        min={0}
                        max={reviews.summary.count}
                        value={reviews.summary.distribution[star - 1]}
                      />
                      <span className="muted">{reviews.summary.distribution[star - 1]}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">{t('noReviews')}</p>
            )}
            {signedIn ? (
              // Only customers who received the product can write a review.
              myReview?.canReview ? (
                <div id="write-review" style={{ scrollMarginTop: 'calc(var(--header-h) + 60px)' }}>
                  <ReviewForm slug={product.slug} existing={myReview.review} />
                </div>
              ) : (
                <p className="muted" id="write-review">
                  {t('reviewAfterDelivery')}
                </p>
              )
            ) : (
              <p className="muted">
                {rich(t('signInToReview'), {
                  link: (chunk) => (
                    <Link key="link" href={`/account/login?next=/p/${product.slug}%23reviews`}>
                      {chunk}
                    </Link>
                  ),
                })}
              </p>
            )}
          </div>
          <div>
            {reviews?.summary.count ? (
              <ReviewList
                key={product.slug}
                slug={product.slug}
                initial={reviews}
                signedIn={signedIn}
                initialVotes={myReview?.helpfulVotes ?? []}
              />
            ) : null}
          </div>
        </div>
      </section>

      {bundleOffers.length ? (
        <div className="section stack" style={{ gap: 12 }}>
          {bundleOffers.map((bundle) => (
            <BundleOffer key={bundle.id} bundle={bundle} currentId={product.id} />
          ))}
        </div>
      ) : null}

      <PriceHistorySection slug={product.slug} days={ph} />

      <Questions slug={product.slug} initial={questions} signedIn={signedIn} />

      {related.boughtTogether.some((p) => p.inStock && p.defaultVariantId) ? (
        <BoughtTogether
          title={t('oftenBoughtTogether')}
          current={(() => {
            const sellable = product.variants.filter((v) => v.isActive && v.available > 0);
            return sellable.length === 1
              ? {
                  variantId: sellable[0]!.id,
                  title: product.title,
                  slug: product.slug,
                  priceCents: sellable[0]!.priceCents,
                  image: product.images[0]?.url ?? null,
                }
              : null;
          })()}
          others={related.boughtTogether}
        />
      ) : (
        <ProductRail
          id="together"
          title={t('oftenBoughtTogether')}
          products={related.boughtTogether}
        />
      )}
      <ProductRail id="sponsored" title={a('sponsoredRelated')} sponsored={ads} />
      <ProductRail id="similar" title={t('similarProducts')} products={related.similar} />
      {related.similar.length ? (
        <p className="compare-similar">
          <Link
            className="btn btn--secondary"
            href={`/compare?products=${[product.slug, ...related.similar.slice(0, 3).map((p) => p.slug)].join(',')}`}
          >
            {cmp('similar')}
          </Link>
        </p>
      ) : null}
      <ProductRail id="also-viewed" title={t('alsoViewed')} products={related.alsoViewed} />
      <ViewTracker productId={product.id} />
    </div>
  );
}
