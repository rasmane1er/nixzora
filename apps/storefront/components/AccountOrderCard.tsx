import { type AccountOrder, type BuyAgainItem } from '@nixzora/validation';
import Link from 'next/link';
import { buyAgain } from '@/app/account/hub-actions';
import { orderStatusText } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';
import { StatusPill } from './OrderSummary';

/**
 * One order in the order history, like a receipt card: when, how much and who it ships to on
 * top; the items with "Buy it again" and "Write a review"; tracking, returns and details on the
 * side.
 */
export async function AccountOrderCard({ order, back }: { order: AccountOrder; back: string }) {
  const [t, f] = await Promise.all([getT('accountActivity'), getFormat()]);
  const placed = order.placedAt ?? order.createdAt;
  return (
    <article className="order-card">
      <header className="order-card__head">
        <dl>
          <div>
            <dt>{t('orderPlaced')}</dt>
            <dd>{f.date(placed)}</dd>
          </div>
          <div>
            <dt>{t('total')}</dt>
            <dd>{f.money(order.totalCents, order.currency)}</dd>
          </div>
          {order.shipTo ? (
            <div className="hide-sm">
              <dt>{t('shipTo')}</dt>
              <dd>{order.shipTo}</dd>
            </div>
          ) : null}
        </dl>
        <div className="order-card__number">
          <span className="mono">{order.number}</span>
          <Link href={`/orders/${order.number}`}>{t('orderDetails')}</Link>
        </div>
      </header>

      <div className="order-card__body">
        <div className="stack" style={{ gap: 14 }}>
          <p className="order-card__status">
            <StatusPill status={order.status} />{' '}
            <strong>
              {order.status === 'DELIVERED' && order.deliveredAt
                ? t('deliveredOn', { date: f.date(order.deliveredAt) })
                : orderStatusText(t, order.status)}
            </strong>
            {order.openReturns ? (
              <span className="muted">
                {' '}
                · {t('returnsInProgress', { count: order.openReturns })}
              </span>
            ) : null}
          </p>
          <ul className="order-lines">
            {order.lines.map((line) => (
              <li key={line.orderItemId}>
                <div className="order-lines__img">
                  {line.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.imageUrl} alt="" width={88} height={88} loading="lazy" />
                  ) : null}
                </div>
                <div className="stack" style={{ gap: 4 }}>
                  {line.productSlug ? (
                    <Link href={`/p/${line.productSlug}`} className="order-lines__title">
                      {line.productTitle}
                    </Link>
                  ) : (
                    <span className="order-lines__title">{line.productTitle}</span>
                  )}
                  <span className="muted" style={{ fontSize: 14 }}>
                    {line.variantTitle} · {t('qty', { quantity: line.quantity })}
                    {line.seller ? (
                      <>
                        {' '}
                        · {t('soldBy')}{' '}
                        <Link href={`/s/${line.seller.handle}`}>{line.seller.displayName}</Link>
                      </>
                    ) : null}
                  </span>
                  <div className="order-lines__actions">
                    {line.canBuyAgain && line.variantId ? (
                      <form action={buyAgain}>
                        <input type="hidden" name="variantId" value={line.variantId} />
                        <input type="hidden" name="back" value={back} />
                        <button className="btn btn--primary btn--sm" type="submit">
                          {t('buyItAgain')}
                        </button>
                      </form>
                    ) : null}
                    {line.canReview && line.productSlug ? (
                      <Link
                        className="btn btn--secondary btn--sm"
                        href={`/p/${line.productSlug}#write-review`}
                      >
                        {t('writeReview')}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="order-card__side">
          {order.tracking?.url ? (
            <a
              className="btn btn--primary"
              href={order.tracking.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('trackPackage')}
            </a>
          ) : null}
          {order.returnableUntil ? (
            <Link className="btn btn--secondary" href={`/orders/${order.number}#return`}>
              {t('returnOrReplace')}
            </Link>
          ) : null}
          <Link className="btn btn--secondary" href={`/orders/${order.number}`}>
            {t('viewOrder')}
          </Link>
          {order.returnableUntil ? (
            <span className="hint">
              {t('returnsOpenUntil', { date: f.date(order.returnableUntil) })}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** A product from past orders, one tap from the cart. */
export async function BuyAgainCard({ item, back }: { item: BuyAgainItem; back: string }) {
  const [t, f] = await Promise.all([getT('accountActivity'), getFormat()]);
  return (
    <div className="buy-again">
      <Link href={`/p/${item.slug}`} className="buy-again__img">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" width={160} height={120} loading="lazy" />
        ) : null}
      </Link>
      <Link href={`/p/${item.slug}`} className="buy-again__title">
        {item.title}
      </Link>
      <span className="muted" style={{ fontSize: 13 }}>
        {item.variantTitle} · {f.money(item.priceCents, item.currency)}
      </span>
      {item.inStock ? (
        <form action={buyAgain}>
          <input type="hidden" name="variantId" value={item.variantId} />
          <input type="hidden" name="back" value={back} />
          <button className="btn btn--secondary btn--sm" type="submit" style={{ width: '100%' }}>
            {t('addToCart')}
          </button>
        </form>
      ) : (
        <span className="hint">{t('outOfStock')}</span>
      )}
    </div>
  );
}
