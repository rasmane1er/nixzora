import {
  type ClipCouponView,
  type ProductCard as Card,
  type SmartRow,
  type SponsoredProduct,
} from '@nixzora/validation';
import { Price } from '@nixzora/ui';
import { INTL_LOCALE } from '@nixzora/i18n';
import Link from 'next/link';
import { adHref } from '@/lib/ads';
import { couponLabel } from '@/lib/coupons';
import { departmentName, getFormat, getLocale, getT } from '@/lib/i18n';
import { AboutAds } from './AboutAds';
import { CardAdd } from './CardActions';
import { ClipButton } from './ClipButton';
import { DealTimer } from './DealTimer';
import { RailArrows } from './RailArrows';

/**
 * Card shapes (ADR-0061). Pages mix these with the standard ProductCard so each section reads
 * differently: four-up quads, one big spotlight deal, deal tiles, photo-and-facts rows, small
 * price tiles, a price-drop card, buy-again cards, an Ask card and dashed coupon cards.
 */

/** The server's clock for this render (countdowns start from it). */
const renderedAt = () => Date.now();

function Photo({ product, size }: { product: Card; size: number }) {
  return product.image ? (
    // eslint-disable-next-line @next/next/no-img-element -- product photo from our media host
    <img src={product.image.url} alt="" width={size} height={size} loading="lazy" />
  ) : (
    <span aria-hidden="true" />
  );
}

export type QuadItem = {
  href: string;
  product: Card;
  /** Under the photo: a category, a short title, or "-20%". */
  label: string;
  sub?: string;
  badge?: string;
};

/** Four products under one title, the classic store tile ("Deals in Kitchen"). */
export function QuadCard({
  id,
  title,
  items,
  link,
}: {
  id: string;
  title: string;
  items: QuadItem[];
  link?: { href: string; label: string };
}) {
  if (!items.length) return null;
  return (
    <section className="shape-card quad" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="shape-card__title">
        {title}
      </h2>
      <ul className="quad__grid">
        {items.slice(0, 4).map((item) => (
          <li key={item.product.id}>
            <Link href={item.href} className="quad__item">
              <span className="quad__photo">
                <Photo product={item.product} size={180} />
                {item.badge ? <span className="shape-badge">{item.badge}</span> : null}
              </span>
              <span className="quad__label">{item.label}</span>
              {item.sub ? <span className="quad__sub">{item.sub}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      {link ? (
        <Link className="shape-card__link" href={link.href}>
          {link.label}
        </Link>
      ) : null}
    </section>
  );
}

/** Quad items for deals: the photo, the department and the discount. */
export async function dealQuadItems(products: Card[]): Promise<QuadItem[]> {
  const f = await getFormat();
  return Promise.all(
    products.map(async (product) => ({
      href: `/p/${product.slug}`,
      product,
      label: await departmentName(product.category),
      badge: product.deal ? `−${f.percent(product.deal.percentOff / 100)}` : undefined,
    })),
  );
}

/** "Keep shopping for": products opened again and again, with how many times. */
export async function KeepShopping({ row }: { row: SmartRow }) {
  const t = await getT('cards');
  return (
    <QuadCard
      id="keep-shopping"
      title={t('keepShopping')}
      items={row.products.map((product) => {
        const views = row.details?.[product.id]?.views;
        return {
          href: `/p/${product.slug}`,
          product,
          label: product.title,
          sub: views ? t('viewedTimes', { count: views }) : undefined,
        };
      })}
      link={{ href: '/account/history', label: t('seeHistory') }}
    />
  );
}

/** One big deal, the one ending soonest: photo, countdown, price, claimed bar, add. */
export async function SpotlightDeal({ product }: { product: Card }) {
  const [t, d, f] = await Promise.all([getT('cards'), getT('deals'), getFormat()]);
  const deal = product.deal!;
  return (
    <section className="shape-card spotlight" aria-labelledby="spotlight-title">
      <Link href={`/p/${product.slug}`} className="spotlight__photo" tabIndex={-1}>
        <Photo product={product} size={320} />
      </Link>
      <div className="spotlight__body">
        <p className="spotlight__eyebrow">
          <span className="shape-badge">
            {d(deal.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')}
          </span>
          <span>{t('endsSoonest')}</span>
        </p>
        <h2 id="spotlight-title" className="spotlight__title">
          <Link href={`/p/${product.slug}`}>{product.title}</Link>
        </h2>
        <p className="spotlight__price">
          <strong>{f.money(product.priceFromCents, product.currency)}</strong>
          {product.compareAtCents ? (
            <s>{f.money(product.compareAtCents, product.currency)}</s>
          ) : null}
          <span>−{f.percent(deal.percentOff / 100)}</span>
        </p>
        <DealTimer
          endsAt={deal.endsAt}
          claimedPercent={deal.kind === 'LIGHTNING' ? deal.claimedPercent : null}
          initialNow={renderedAt()}
        />
        <div className="spotlight__actions">
          {product.storeAway ? null : (
            <CardAdd
              variantId={product.defaultVariantId}
              slug={product.slug}
              title={product.title}
              inStock={product.inStock}
            />
          )}
          <Link className="btn btn--ghost-light btn--sm" href={`/p/${product.slug}`}>
            {t('seeDeal')}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** A compact deal: big percent badge, price and was-price, title, countdown and claimed bar. */
export async function DealTile({ product }: { product: Card }) {
  const [t, f, locale] = await Promise.all([getT('cards'), getFormat(), getLocale()]);
  const deal = product.deal;
  const plus = deal?.plusOnly === true;
  return (
    <article className="shape-card deal-tile">
      <Link href={`/p/${product.slug}`} className="deal-tile__link">
        <span className="deal-tile__photo">
          <Photo product={product} size={200} />
        </span>
        {deal ? (
          <span className={`shape-badge${plus ? ' shape-badge--plus' : ''}`}>
            −{f.percent(deal.percentOff / 100)}
            {plus ? ` · ${t('plusDeal')}` : ''}
          </span>
        ) : null}
        <Price
          cents={product.priceFromCents}
          compareAtCents={product.compareAtCents}
          currency={product.currency}
          locale={INTL_LOCALE[locale]}
        />
        <span className="deal-tile__title">{product.title}</span>
      </Link>
      {deal ? (
        <DealTimer
          endsAt={deal.endsAt}
          claimedPercent={deal.kind === 'LIGHTNING' ? deal.claimedPercent : null}
          initialNow={renderedAt()}
        />
      ) : null}
    </article>
  );
}

/** Deal tiles in a sideways rail, or a grid with `grid`. */
export function DealTiles({
  id,
  title,
  products,
  link,
  grid = false,
}: {
  id: string;
  title?: string;
  products: Card[];
  link?: { href: string; label: string };
  grid?: boolean;
}) {
  if (!products.length) return null;
  const list = (
    <ul
      className={grid ? 'deal-tiles' : 'rail__track rail__track--tiles'}
      id={`${id}-track`}
      tabIndex={grid ? undefined : 0}
      aria-label={title}
    >
      {products.map((product) => (
        <li key={product.id} className={grid ? undefined : 'rail__item rail__item--tile'}>
          <DealTile product={product} />
        </li>
      ))}
    </ul>
  );
  if (!title) return list;
  return (
    <section className="section rail" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{title}</h2>
        {link ? (
          <Link className="section-link rail__link" href={link.href}>
            {link.label} →
          </Link>
        ) : null}
        {grid ? null : <RailArrows target={`${id}-track`} />}
      </div>
      {list}
    </section>
  );
}

/**
 * A question the assistant answers, from what the shopper searched or asked, with its picks. A
 * new shopper gets one of the home page's example questions, without photos.
 */
export async function AskCard({
  subject,
  source,
  products = [],
}: {
  subject: string;
  source: SmartRow['source'];
  products?: Card[];
}) {
  const t = await getT('cards');
  return (
    <section className="shape-card ask-card" aria-labelledby="ask-card-title">
      <p className="ask-card__eyebrow">
        {source === 'assistant'
          ? t('askAssistant')
          : source === 'search'
            ? t('askSearched')
            : t('askTry')}
      </p>
      <h2 id="ask-card-title" className="ask-card__title">
        “{subject}”
      </h2>
      {products.length ? (
        <ul className="ask-card__photos" aria-hidden="true">
          {products.slice(0, 3).map((product) => (
            <li key={product.id}>
              <Photo product={product} size={120} />
            </li>
          ))}
        </ul>
      ) : null}
      <Link className="btn ask-card__cta" href={`/assistant?q=${encodeURIComponent(subject)}`}>
        {t('askCta')}
      </Link>
    </section>
  );
}

/** A saved product that got cheaper, with the saving in money. */
export async function PriceDropCard({ product, wasCents }: { product: Card; wasCents: number }) {
  const [t, f] = await Promise.all([getT('cards'), getFormat()]);
  return (
    <Link href={`/p/${product.slug}`} className="shape-card price-drop">
      <span className="price-drop__photo">
        <Photo product={product} size={140} />
      </span>
      <span className="price-drop__body">
        <span className="price-drop__eyebrow">{t('priceDropped')}</span>
        <span className="price-drop__title">{product.title}</span>
        <span className="price-drop__price">
          <strong>{f.money(product.priceFromCents, product.currency)}</strong>
          <s>{f.money(wasCents, product.currency)}</s>
        </span>
        <span className="price-drop__save">
          {t('youSave', { amount: f.money(wasCents - product.priceFromCents, product.currency) })}
        </span>
      </span>
    </Link>
  );
}

/** Things that run out, bought before: when, the price, and one tap to buy again. */
export async function BuyAgain({ row }: { row: SmartRow }) {
  const [t, f] = await Promise.all([getT('cards'), getFormat()]);
  return (
    <section className="shape-card buy-again" aria-labelledby="buy-again-title">
      <div className="shape-card__head">
        <h2 id="buy-again-title" className="shape-card__title">
          {t('buyAgain')}
        </h2>
        <Link className="shape-card__link" href="/account/orders">
          {t('yourOrders')}
        </Link>
      </div>
      <ul className="buy-again__list">
        {row.products.slice(0, 4).map((product) => {
          const last = row.details?.[product.id]?.lastBoughtAt;
          return (
            <li key={product.id} className="buy-again__item">
              <Link href={`/p/${product.slug}`} className="buy-again__link">
                <span className="buy-again__photo">
                  <Photo product={product} size={120} />
                </span>
                <span className="buy-again__title">{product.title}</span>
                {last ? (
                  <span className="buy-again__when">{t('lastBought', { date: f.date(last) })}</span>
                ) : null}
                <strong>{f.money(product.priceFromCents, product.currency)}</strong>
              </Link>
              <CardAdd
                variantId={product.defaultVariantId}
                slug={product.slug}
                title={product.title}
                inStock={product.inStock}
                label={t('buyAgain')}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Photo on the left, the facts on the right, a round add button: for short lists. */
export async function RowCard({ product }: { product: Card }) {
  const [tp, f] = await Promise.all([getT('product'), getFormat()]);
  const rating = product.rating;
  return (
    <article className="shape-card row-card">
      <Link href={`/p/${product.slug}`} className="row-card__link">
        <span className="row-card__photo">
          <Photo product={product} size={120} />
        </span>
        <span className="row-card__body">
          <span className="row-card__title">{product.title}</span>
          {rating && rating.count > 0 && rating.average != null ? (
            <span
              className="row-card__rating"
              aria-label={tp('rating', { rating: f.number(rating.average), count: rating.count })}
            >
              <span aria-hidden="true">
                {'★'.repeat(Math.round(rating.average))}
                {'☆'.repeat(5 - Math.round(rating.average))}
              </span>{' '}
              <span className="muted">({rating.count})</span>
            </span>
          ) : null}
          <strong className="row-card__price">
            {f.money(product.priceFromCents, product.currency)}
          </strong>
          {product.delivery && product.inStock ? (
            <span className="row-card__delivery">
              {tp('deliveryBy', { date: f.day(`${product.delivery.latest}T12:00:00Z`) })}
            </span>
          ) : null}
        </span>
      </Link>
      {product.storeAway || !product.inStock ? null : product.defaultVariantId ? (
        <span className="row-card__add">
          <CardAdd
            variantId={product.defaultVariantId}
            slug={product.slug}
            title={product.title}
            inStock={product.inStock}
          />
        </span>
      ) : null}
    </article>
  );
}

/** A titled list of row cards. */
export function RowCards({ id, title, products }: { id: string; title: string; products: Card[] }) {
  if (!products.length) return null;
  return (
    <section className="row-cards" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="shape-card__title">
        {title}
      </h2>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <RowCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Small photo-and-price tiles in a rail; sponsored ones are labelled and record the click. */
export async function PriceTiles({
  id,
  title,
  products = [],
  sponsored,
}: {
  id: string;
  title: string;
  products?: Card[];
  sponsored?: SponsoredProduct[];
}) {
  const items = sponsored ?? products.map((product) => ({ product, token: undefined }));
  if (!items.length) return null;
  const [f, a] = await Promise.all([getFormat(), getT('ads')]);
  return (
    <section className="section rail" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <RailArrows target={`${id}-track`} />
      </div>
      {sponsored ? <AboutAds /> : null}
      <ul
        className="rail__track rail__track--prices"
        id={`${id}-track`}
        tabIndex={0}
        aria-label={title}
      >
        {items.map(({ product, token }) => {
          const body = (
            <>
              <span className="price-tile__photo">
                <Photo product={product} size={140} />
              </span>
              <strong>{f.money(product.priceFromCents, product.currency)}</strong>
              <span className="sr-only">{product.title}</span>
              {token ? <span className="price-tile__ad">{a('sponsored')}</span> : null}
            </>
          );
          return (
            <li key={product.id} className="rail__item rail__item--price">
              {token ? (
                <a
                  href={adHref(token)}
                  className="price-tile"
                  rel="sponsored"
                  title={product.title}
                >
                  {body}
                </a>
              ) : (
                <Link href={`/p/${product.slug}`} className="price-tile" title={product.title}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A dashed coupon: the saving, the product, and the clip button. */
export async function CouponCard({
  coupon,
  clipped,
}: {
  coupon: ClipCouponView;
  clipped: boolean;
}) {
  const [t, f] = await Promise.all([getT('clips'), getFormat()]);
  const label = couponLabel(coupon, t, f);
  return (
    <article className="coupon-shape">
      <Link href={`/p/${coupon.product.slug}`} className="coupon-shape__photo" tabIndex={-1}>
        <Photo product={coupon.product} size={96} />
      </Link>
      <div className="coupon-shape__body">
        <Link href={`/p/${coupon.product.slug}`} className="coupon-shape__title">
          {coupon.product.title}
        </Link>
        <ClipButton couponId={coupon.id} label={label} initial={clipped} compact />
      </div>
    </article>
  );
}
