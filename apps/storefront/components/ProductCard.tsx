import { type ProductCard as Card, twoDayWindow } from '@nixzora/validation';
import { deliveryDay, INTL_LOCALE, rich } from '@nixzora/i18n';
import { Price } from '@nixzora/ui';
import Link from 'next/link';
import { adHref } from '@/lib/ads';
import { departmentName, getFormat, getLocale, getT } from '@/lib/i18n';
import { isPlusMember } from '@/lib/plus';
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
  const [t, a, d, pl, locale, f, wishlist, member] = await Promise.all([
    getT('product'),
    getT('ads'),
    getT('deals'),
    getT('plus'),
    getLocale(),
    getFormat(),
    wishedIds(),
    isPlusMember(),
  ]);
  // "Arrives …" (p10-17): Plus members get NIXZORA's own items in 2 days, free.
  const twoDay = member && product.shipsFromNixzora === true;
  const window = product.inStock ? (twoDay ? twoDayWindow(new Date()) : product.delivery) : null;
  const deliveryText = (() => {
    if (!window) return null;
    const day = deliveryDay(window.latest, locale);
    const when = day.tomorrow
      ? t('deliveryTomorrow', { date: day.text })
      : window.earliest === window.latest
        ? day.text
        : t('deliveryBy', { date: day.text });
    const key = twoDay
      ? 'deliveryPlus'
      : member || product.freeDelivery
        ? 'deliveryFree'
        : 'deliveryPaid';
    return rich(t(key, { date: `<b>${when}</b>` }), {
      b: (chunk) => <strong key="when">{chunk}</strong>,
    });
  })();
  const bought =
    product.boughtPastMonth != null
      ? new Intl.NumberFormat(INTL_LOCALE[locale], { notation: 'compact' }).format(
          product.boughtPastMonth,
        )
      : null;
  const wished = wishlist.has(product.id);
  const rating = product.rating;
  const onSale = product.compareAtCents != null && product.compareAtCents > product.priceFromCents;
  const deal = product.deal;
  // A member-only deal (p10-15) leaves the price as listed and shows the member price.
  const plusOnly = deal?.plusOnly === true;
  const badge = deal
    ? {
        kind: plusOnly ? 'plus' : 'deal',
        text: `${plusOnly ? pl('plusPrice') : d(deal.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')} · ${d(
          'percentOff',
          {
            percent: f.percent(deal.percentOff / 100),
          },
        )}`,
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
        {bought ? (
          <span className="card-bought">{t('boughtPastMonth', { count: bought })}</span>
        ) : null}
        <Price
          cents={product.priceFromCents}
          compareAtCents={product.compareAtCents}
          currency={product.currency}
          prefix={product.defaultVariantId ? undefined : t('from')}
          locale={INTL_LOCALE[locale]}
          wasLabel={t('was')}
        />
        {deal && plusOnly ? (
          <span className="plus-price">
            {pl('memberPrice', {
              price: f.money(
                Math.max(1, Math.round((product.priceFromCents * (100 - deal.percentOff)) / 100)),
              ),
            })}
          </span>
        ) : null}
        {deal ? (
          <DealTimer
            endsAt={deal.endsAt}
            claimedPercent={deal.kind === 'LIGHTNING' ? deal.claimedPercent : null}
            initialNow={renderedAt()}
          />
        ) : null}
        {deliveryText ? (
          <span className="card-delivery">
            {twoDay ? <span className="plus-chip">{pl('badge')}</span> : null} {deliveryText}
          </span>
        ) : (
          <span className={`stock${product.inStock ? '' : ' stock--out'}`}>
            {product.inStock ? t('inStock') : t('soldOut')}
          </span>
        )}
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
