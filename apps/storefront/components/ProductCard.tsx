import { type ProductCard as Card } from '@nixzora/validation';
import { INTL_LOCALE } from '@nixzora/i18n';
import { Price } from '@nixzora/ui';
import Link from 'next/link';
import { adHref } from '@/lib/ads';
import { departmentName, getFormat, getLocale, getT } from '@/lib/i18n';
import { wishedIds } from '@/lib/wishlist';
import { CardAdd, CardHeart } from './CardActions';
import { DealTimer } from './DealTimer';

/** The server's clock for this render (deal countdowns start from it). */
const renderedAt = () => Date.now();

/** Stars for an average out of 5 (half stars rounded to the nearest half). */
function StarRow({ average }: { average: number }) {
  const halves = Math.round(average * 2);
  return (
    <span className="card-stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={halves >= (i + 1) * 2 ? 'on' : halves === i * 2 + 1 ? 'half' : 'off'}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * A product in a grid or rail: photo, brand, title, rating, price, a save heart and, for
 * single-option products, a one-tap "Add to cart".
 */
export async function ProductCard({
  product,
  priority = false,
  adToken,
}: {
  product: Card;
  priority?: boolean;
  /** A sponsored product (p10-01): labelled, and its link records the click. */
  adToken?: string;
}) {
  // Together, not one after another: under load every await waits in line again.
  const [t, a, d, locale, f, wishlist] = await Promise.all([
    getT('product'),
    getT('ads'),
    getT('deals'),
    getLocale(),
    getFormat(),
    wishedIds(),
  ]);
  const wished = wishlist.has(product.id);
  const rating = product.rating;
  const onSale = product.compareAtCents != null && product.compareAtCents > product.priceFromCents;
  const deal = product.deal;
  const badge = deal
    ? {
        kind: 'deal',
        text: `${d(deal.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')} · ${d('percentOff', {
          percent: f.percent(deal.percentOff / 100),
        })}`,
      }
    : onSale
      ? {
          kind: 'sale',
          text: t('sale', {
            percent: f.percent(
              Math.round((1 - product.priceFromCents / (product.compareAtCents as number)) * 100) /
                100,
            ),
          }),
        }
      : rating?.average != null && rating.average >= 4.5 && rating.count >= 3
        ? { kind: 'top', text: t('topRated') }
        : null;

  const body = (
    <>
      <div className="product-card__img">
        {product.image ? (
          // Product photos come from our media host/CDN; sizes are fixed by the card.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image.url}
            alt={product.image.alt}
            loading={priority ? 'eager' : 'lazy'}
            width={400}
            height={300}
          />
        ) : (
          <span aria-hidden="true">{await departmentName(product.category)}</span>
        )}
      </div>
      <div className="product-card__body">
        {adToken ? <span className="product-card__sponsored">{a('sponsored')}</span> : null}
        <span className="product-card__brand">{product.brand?.name ?? ' '}</span>
        <span className="product-card__title">{product.title}</span>
        {rating && rating.count > 0 && rating.average != null ? (
          <span
            className="card-rating"
            aria-label={t('rating', { rating: f.number(rating.average), count: rating.count })}
          >
            <StarRow average={rating.average} />
            <span className="muted">{t('reviewCount', { count: rating.count })}</span>
          </span>
        ) : null}
        <Price
          cents={product.priceFromCents}
          compareAtCents={product.compareAtCents}
          currency={product.currency}
          prefix={product.defaultVariantId ? undefined : t('from')}
          locale={INTL_LOCALE[locale]}
          wasLabel={t('was')}
        />
        {deal ? (
          <DealTimer
            endsAt={deal.endsAt}
            claimedPercent={deal.kind === 'LIGHTNING' ? deal.claimedPercent : null}
            initialNow={renderedAt()}
          />
        ) : null}
        <span className={`stock${product.inStock ? '' : ' stock--out'}`}>
          {product.inStock ? t('inStock') : t('soldOut')}
        </span>
      </div>
    </>
  );

  return (
    <article className={`product-card${adToken ? ' product-card--sponsored' : ''}`}>
      {adToken ? (
        // A plain link, never prefetched: opening it is what records (and may charge) the click.
        <a href={adHref(adToken)} className="product-card__link" rel="sponsored">
          {body}
        </a>
      ) : (
        <Link href={`/p/${product.slug}`} className="product-card__link">
          {body}
        </Link>
      )}
      {badge ? <span className={`card-badge card-badge--${badge.kind}`}>{badge.text}</span> : null}
      <CardHeart productId={product.id} title={product.title} initial={wished} />
      <div className="product-card__actions">
        <CardAdd
          variantId={product.defaultVariantId}
          slug={product.slug}
          title={product.title}
          inStock={product.inStock}
        />
      </div>
    </article>
  );
}
