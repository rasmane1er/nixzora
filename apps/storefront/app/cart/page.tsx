import { formatMoney, Price } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { currentCart } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';
import { applyCoupon, removeCoupon, updateLine } from './actions';

export const metadata: Metadata = { title: 'Your cart', robots: { index: false } };

export default async function CartPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const cart = await currentCart();
  const error = param(params, 'error');

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="wrap section">
        <h1>Your cart</h1>
        {error ? <p className="banner banner--error">{error}</p> : null}
        <div className="empty card" style={{ marginTop: 20 }}>
          <p>Your cart is empty.</p>
          <p style={{ marginTop: 12 }}>
            <Link className="btn btn--primary" href="/search">
              Browse products
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const blocked = cart.lines.some((line) => line.problem);
  const t = cart.totals;
  const threshold = t.subtotalCents + t.freeShippingRemainingCents;

  return (
    <div className="wrap section">
      <h1>Your cart</h1>
      <p className="muted" style={{ margin: '6px 0 20px' }}>
        {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
      </p>
      {error ? (
        <p className="banner banner--error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      ) : null}

      <div className="cart">
        <section aria-label="Items">
          {cart.lines.map((line) => (
            <article key={line.variantId} className="cart-line">
              <div className="cart-line__img">
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={line.imageUrl} alt="" width={96} height={96} />
                ) : null}
              </div>
              <div>
                <Link href={`/p/${line.productSlug}`} style={{ fontWeight: 600 }}>
                  {line.productTitle}
                </Link>
                <div className="muted">{line.variantTitle}</div>
                {line.problem === 'UNAVAILABLE' ? (
                  <p className="field-error">No longer available — remove it to check out.</p>
                ) : line.problem === 'INSUFFICIENT_STOCK' ? (
                  <p className="field-error">Only {line.available} left — lower the quantity.</p>
                ) : null}
                <div className="cart-line__actions">
                  <form action={updateLine} className="cart-line__actions" style={{ margin: 0 }}>
                    <input type="hidden" name="variantId" value={line.variantId} />
                    <label className="check" style={{ gap: 6 }}>
                      Qty
                      <select
                        name="quantity"
                        defaultValue={line.quantity}
                        aria-label={`Quantity of ${line.productTitle}`}
                      >
                        {Array.from(
                          {
                            length: Math.max(
                              line.quantity,
                              Math.min(10, Math.max(1, line.available)),
                            ),
                          },
                          (_, i) => i + 1,
                        ).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="btn btn--secondary btn--sm" type="submit">
                      Update
                    </button>
                  </form>
                  <form action={updateLine} style={{ margin: 0 }}>
                    <input type="hidden" name="variantId" value={line.variantId} />
                    <input type="hidden" name="quantity" value="0" />
                    <button className="btn btn--link" type="submit">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
              <div className="num">
                <strong>{formatMoney(line.lineTotalCents)}</strong>
                {line.quantity > 1 ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    <Price cents={line.unitPriceCents} /> each
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        <aside className="card summary" aria-label="Order summary">
          <h2>Summary</h2>
          <dl>
            <dt>Subtotal</dt>
            <dd>{formatMoney(t.subtotalCents)}</dd>
            {t.discountCents ? (
              <>
                <dt>Discount ({cart.coupon?.code})</dt>
                <dd className="discount">−{formatMoney(t.discountCents)}</dd>
              </>
            ) : null}
            <dt>Shipping</dt>
            <dd>{t.shippingCents ? formatMoney(t.shippingCents) : 'Free'}</dd>
            <dt>Tax</dt>
            <dd className="muted">At checkout</dd>
            <dt className="total">Estimated total</dt>
            <dd className="total">
              {formatMoney(t.subtotalCents - t.discountCents + t.shippingCents)}
            </dd>
          </dl>
          {cart.coupon ? (
            <form action={removeCoupon} className="coupon">
              <span>
                <span className="mono">{cart.coupon.code}</span>
                {cart.coupon.problem ? (
                  <span className="field-error"> — {cart.coupon.problem}</span>
                ) : cart.coupon.description ? (
                  <span className="muted"> — {cart.coupon.description}</span>
                ) : null}
              </span>
              <button className="btn btn--link" type="submit">
                Remove
              </button>
            </form>
          ) : (
            <form action={applyCoupon} className="coupon">
              <input
                name="code"
                placeholder="Discount code"
                aria-label="Discount code"
                maxLength={32}
                required
              />
              <button className="btn btn--secondary btn--sm" type="submit">
                Apply
              </button>
            </form>
          )}
          {t.freeShippingRemainingCents > 0 ? (
            <div className="free-ship">
              <progress
                value={t.subtotalCents}
                max={threshold}
                aria-label="Progress to free shipping"
              />
              <span>Add {formatMoney(t.freeShippingRemainingCents)} for free shipping.</span>
            </div>
          ) : (
            <p className="free-ship">You’ve got free shipping.</p>
          )}
          {blocked || cart.coupon?.problem ? (
            <p className="banner banner--info">
              {blocked
                ? 'Fix the highlighted items to continue.'
                : 'Remove the code that no longer applies to continue.'}
            </p>
          ) : (
            <Link className="btn btn--primary btn--block" href="/checkout">
              Check out
            </Link>
          )}
          <Link href="/search" className="muted" style={{ textAlign: 'center', fontSize: 14 }}>
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
