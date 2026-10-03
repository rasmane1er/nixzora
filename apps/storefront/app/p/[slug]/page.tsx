import {
  type ProductDetail,
  type RatingSummary,
  type RelatedProducts,
  type ReviewInsights as Insights,
  type ReviewView,
} from '@nixzora/validation';
import { INTL_LOCALE, rich } from '@nixzora/i18n';
import { Price } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductRail } from '@/components/ProductRail';
import { SellerRating } from '@/components/SellerRating';
import { ReviewInsights } from '@/components/ReviewInsights';
import { Stars } from '@/components/Stars';
import { api, ApiError, catalog } from '@/lib/api';
import { departmentName, getFormat, getLocale, getT } from '@/lib/i18n';
import { isSignedIn } from '@/lib/session';
import { SITE_URL } from '@/lib/params';
import { AddToCart } from './AddToCart';
import { Gallery } from './Gallery';
import { ReviewForm } from './ReviewForm';
import { ViewTracker } from './ViewTracker';
import { WishButton } from './WishButton';

type ReviewPage = {
  summary: RatingSummary;
  reviews: ReviewView[];
  page: number;
  totalPages: number;
};

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

const UNITS: Record<string, string> = {
  gb: 'GB',
  tb: 'TB',
  in: 'inches',
  kg: 'kg',
  g: 'g',
  hz: 'Hz',
  hours: 'hours',
  mah: 'mAh',
  w: 'W',
};
const WORDS: Record<string, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  ram: 'RAM',
  ssd: 'SSD',
  usb: 'USB',
  wifi: 'Wi-Fi',
  anc: 'ANC',
};

/** "battery_hours" → "Battery (hours)", "ram_gb" → "RAM (GB)", "cpu_cores" → "CPU cores" */
function label(key: string, units: Record<string, string> = UNITS): string {
  const parts = key.split('_');
  const unit = parts.length > 1 ? units[parts[parts.length - 1]!] : undefined;
  const words = (unit ? parts.slice(0, -1) : parts).map((w) => WORDS[w] ?? w);
  const text = words.join(' ');
  const cased = text.charAt(0).toUpperCase() + text.slice(1);
  return unit ? `${cased} (${unit})` : cased;
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
  const [reviews, wishIds, mine, related, insights] = await Promise.all([
    api<ReviewPage>(`/catalog/products/${slug}/reviews`, { auth: false, revalidate: 30 }).catch(
      () => null,
    ),
    signedIn
      ? api<string[]>('/me/wishlist/ids').catch((): string[] => [])
      : Promise.resolve<string[]>([]),
    signedIn
      ? api<{ review: { rating: number; title: string; body: string; status: string } | null }>(
          `/catalog/products/${slug}/reviews/mine`,
        )
          .then((res) => res.review)
          .catch(() => null)
      : Promise.resolve(null),
    api<RelatedProducts>(`/catalog/products/${slug}/related`, {
      auth: false,
      revalidate: 300,
    }).catch((): RelatedProducts => ({ similar: [], boughtTogether: [], alsoViewed: [] })),
    api<{ insights: Insights | null }>(`/catalog/products/${slug}/reviews/insights`, {
      auth: false,
      revalidate: 300,
    })
      .then((res) => res.insights)
      .catch(() => null),
  ]);
  const specs = Object.entries(product.attributes);
  const t = await getT('productPage');
  const p = await getT('product');
  const c = await getT('common');
  const f = await getFormat();
  const locale = await getLocale();
  const units = { ...UNITS, in: t('unitInches'), hours: t('unitHours') };
  /** A known attribute's name in the visitor's language, else built from its key. */
  const specLabel = (key: string) => {
    const known = t(`spec_${key}` as Parameters<typeof t>[0]);
    return known === `spec_${key}` ? label(key, units) : known;
  };
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
          <AddToCart variants={product.variants} />
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
              <div id="write-review" style={{ scrollMarginTop: 'calc(var(--header-h) + 60px)' }}>
                <ReviewForm slug={product.slug} existing={mine} />
              </div>
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
            {reviews?.reviews.map((review) => (
              <article key={review.id} className="review">
                <div className="rating-line">
                  <Stars value={review.rating} />
                  <strong>{review.title}</strong>
                </div>
                <span className="muted" style={{ fontSize: 13 }}>
                  {review.author} · {f.date(review.createdAt)}
                </span>
                {review.verifiedPurchase ? (
                  <span className="badge">{t('verifiedPurchase')}</span>
                ) : null}
                <p className="description">{review.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProductRail
        id="together"
        title={t('oftenBoughtTogether')}
        products={related.boughtTogether}
      />
      <ProductRail id="similar" title={t('similarProducts')} products={related.similar} />
      <ProductRail id="also-viewed" title={t('alsoViewed')} products={related.alsoViewed} />
      <ViewTracker productId={product.id} />
    </div>
  );
}
