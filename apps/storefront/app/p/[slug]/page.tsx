import { type ProductDetail, type RatingSummary, type ReviewView } from '@nixzora/validation';
import { Price } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Stars } from '@/components/Stars';
import { api, ApiError, catalog } from '@/lib/api';
import { isSignedIn } from '@/lib/session';
import { SITE_URL } from '@/lib/params';
import { AddToCart } from './AddToCart';
import { ReviewForm } from './ReviewForm';
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
function label(key: string): string {
  const parts = key.split('_');
  const unit = parts.length > 1 ? UNITS[parts[parts.length - 1]!] : undefined;
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
  const [reviews, wishIds, mine] = await Promise.all([
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
  ]);
  const [main, ...rest] = product.images;
  const specs = Object.entries(product.attributes);

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
          <Link href="/">Home</Link>
        </li>
        {product.breadcrumb.map((crumb) => (
          <li key={crumb.slug}>
            <Link href={`/c/${crumb.slug}`}>{crumb.name}</Link>
          </li>
        ))}
      </ol>

      <div className="pdp">
        <div className="gallery">
          <div className="gallery__main product-card__img">
            {main ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={main.url} alt={main.alt} width={800} height={600} />
            ) : (
              <span aria-hidden="true">{product.category.name}</span>
            )}
          </div>
          {rest.length ? (
            <div className="gallery__thumbs">
              {rest.slice(0, 5).map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={image.id}
                  src={image.url}
                  alt={image.alt}
                  loading="lazy"
                  width={160}
                  height={160}
                />
              ))}
            </div>
          ) : null}
        </div>

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
                  {product.rating.average} · {product.rating.count}{' '}
                  {product.rating.count === 1 ? 'review' : 'reviews'}
                </span>
              </a>
            ) : null}
            <Price
              cents={product.priceFromCents}
              compareAtCents={product.compareAtCents}
              currency={product.currency}
              prefix={product.variants.length > 1 ? 'From' : undefined}
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
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            <li>Free shipping on orders over $99</li>
            <li>30-day returns</li>
            <li>Secure checkout — card details never touch our servers</li>
          </ul>
        </div>
      </div>

      <div className="two section">
        <section className="stack" aria-labelledby="about">
          <h2 id="about">About this product</h2>
          <p className="description">{product.description}</p>
        </section>
        {specs.length ? (
          <section className="stack" aria-labelledby="specs">
            <h2 id="specs">Specifications</h2>
            <table className="specs">
              <tbody>
                {specs.map(([key, value]) => (
                  <tr key={key}>
                    <th scope="row">{label(key)}</th>
                    <td>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
      <section id="reviews" className="section stack" aria-labelledby="reviews-title">
        <h2 id="reviews-title">Customer reviews</h2>
        <div className="reviews">
          <div className="stack">
            {reviews?.summary.count ? (
              <>
                <div className="rating-line" style={{ fontSize: 18 }}>
                  <Stars value={reviews.summary.average ?? 0} size={22} />
                  <strong>{reviews.summary.average} out of 5</strong>
                </div>
                <div className="histogram" aria-label="Ratings breakdown">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star}>
                      <span>{star} star</span>
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
              <p className="muted">No reviews yet.</p>
            )}
            {signedIn ? (
              <ReviewForm slug={product.slug} existing={mine} />
            ) : (
              <p className="muted">
                <Link href={`/account/login?next=/p/${product.slug}%23reviews`}>Sign in</Link> to
                write a review.
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
                  {review.author} ·{' '}
                  {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                    new Date(review.createdAt),
                  )}
                </span>
                {review.verifiedPurchase ? <span className="badge">Verified purchase</span> : null}
                <p className="description">{review.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
