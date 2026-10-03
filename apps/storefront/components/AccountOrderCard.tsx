import { type AccountOrder, type BuyAgainItem } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import Link from 'next/link';
import { buyAgain } from '@/app/account/hub-actions';
import { ORDER_STATUS_TEXT, day } from '@/lib/account';
import { StatusPill } from './OrderSummary';

/**
 * One order in the order history, like a receipt card: when, how much and who it ships to on
 * top; the items with "Buy it again" and "Write a review"; tracking, returns and details on the
 * side.
 */
export function AccountOrderCard({ order, back }: { order: AccountOrder; back: string }) {
  const placed = order.placedAt ?? order.createdAt;
  return (
    <article className="order-card">
      <header className="order-card__head">
        <dl>
          <div>
            <dt>Order placed</dt>
            <dd>{day(placed)}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatMoney(order.totalCents, order.currency)}</dd>
          </div>
          {order.shipTo ? (
            <div className="hide-sm">
              <dt>Ship to</dt>
              <dd>{order.shipTo}</dd>
            </div>
          ) : null}
        </dl>
        <div className="order-card__number">
          <span className="mono">{order.number}</span>
          <Link href={`/orders/${order.number}`}>Order details</Link>
        </div>
      </header>

      <div className="order-card__body">
        <div className="stack" style={{ gap: 14 }}>
          <p className="order-card__status">
            <StatusPill status={order.status} />{' '}
            <strong>
              {order.status === 'DELIVERED' && order.deliveredAt
                ? `Delivered ${day(order.deliveredAt)}`
                : ORDER_STATUS_TEXT[order.status]}
            </strong>
            {order.openReturns ? (
              <span className="muted">
                {' '}
                · {order.openReturns} {order.openReturns === 1 ? 'return' : 'returns'} in progress
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
                    {line.variantTitle} · Qty {line.quantity}
                    {line.seller ? (
                      <>
                        {' '}
                        · Sold by{' '}
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
                          Buy it again
                        </button>
                      </form>
                    ) : null}
                    {line.canReview && line.productSlug ? (
                      <Link
                        className="btn btn--secondary btn--sm"
                        href={`/p/${line.productSlug}#write-review`}
                      >
                        Write a review
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
              Track package
            </a>
          ) : null}
          {order.returnableUntil ? (
            <Link className="btn btn--secondary" href={`/orders/${order.number}#return`}>
              Return or replace items
            </Link>
          ) : null}
          <Link className="btn btn--secondary" href={`/orders/${order.number}`}>
            View order
          </Link>
          {order.returnableUntil ? (
            <span className="hint">Returns open until {day(order.returnableUntil)}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** A product from past orders, one tap from the cart. */
export function BuyAgainCard({ item, back }: { item: BuyAgainItem; back: string }) {
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
        {item.variantTitle} · {formatMoney(item.priceCents, item.currency)}
      </span>
      {item.inStock ? (
        <form action={buyAgain}>
          <input type="hidden" name="variantId" value={item.variantId} />
          <input type="hidden" name="back" value={back} />
          <button className="btn btn--secondary btn--sm" type="submit" style={{ width: '100%' }}>
            Add to cart
          </button>
        </form>
      ) : (
        <span className="hint">Out of stock</span>
      )}
    </div>
  );
}
