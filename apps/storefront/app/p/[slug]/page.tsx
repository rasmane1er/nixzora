import {
  type ProductAlertRef,
  type QuestionPage,
  type ProductDetail,
  type RelatedProducts,
  type ReviewInsights as Insights,
  type ReviewPage,
} from '@nixzora/validation';
import { INTL_LOCALE, rich, specLabel as sharedSpecLabel } from '@nixzora/i18n';
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
import { isSignedIn } from '@/lib/session';
import { SITE_URL } from '@/lib/params';
import { AddToCart } from './AddToCart';
import { Gallery } from './Gallery';
import { ReviewForm } from './ReviewForm';
import { BoughtTogether } from './BoughtTogether';
import { Questions } from './Questions';
import { ReviewList } from './ReviewList';
import { StockAlert } from './StockAlert';
import { ViewTracker } from './ViewTracker';
import { WishButton } from './WishButton';

type Props = { params: Promise<{ slug: string }> };

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

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await load(slug);
  const signedIn = await isSignedIn();
  const inStock = product.variants.some((v) => v.isActive && v.available > 0);
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
            <Price
              cents={product.priceFromCents}
              compareAtCents={product.compareAtCents}
              currency={product.currency}
              prefix={product.variants.length > 1 ? p('from') : undefined}
              locale={INTL_LOCALE[locale]}
              wasLabel={p('was')}
            />
          </div>
          <DeliveryPromise window={product.delivery} />
          <AddToCart variants={product.variants} />
          {!inStock ? (
            <StockAlert
              productId={product.id}
              slug={product.slug}
              signedIn={signedIn}
              initial={alerts.some((x) => x.productId === product.id && x.kind === 'BACK_IN_STOCK')}
            />
          ) : null}
          <div>
            <WishButton
              productId={product.id}
              slug={product.slug}
              initial={wishIds.includes(product.id)}
            />
          </div>
          <p className="sold-by">
            {t('soldBy')}{' '}
            {product.seller ? (
              <>
                <Link href={`/s/${product.seller.handle}`}>{product.seller.displayName}</Link>{' '}
                <SellerRating rating={product.seller.rating} />
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
      <ProductRail id="also-viewed" title={t('alsoViewed')} products={related.alsoViewed} />
      <ViewTracker productId={product.id} />
    </div>
  );
}
