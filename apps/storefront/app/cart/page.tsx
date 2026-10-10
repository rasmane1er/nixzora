import { INTL_LOCALE, rich } from '@nixzora/i18n';
import { Price } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { api, currentCart } from '@/lib/api';
import { DeliveryPromise } from '@/components/DeliveryPromise';
import { PlusLineTag, PlusShippingNote, ShippingAmount } from '@/components/PlusNotes';
import { isSignedIn } from '@/lib/session';
import { getFormat, getLocale, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { type SavedItem } from '@nixzora/validation';
import { applyCoupon, removeCoupon, saveForLater, updateLine } from './actions';
import { SavedForLater } from './SavedForLater';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('cart');
  return { title: t('title'), robots: { index: false } };
}

export default async function CartPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const cart = await currentCart();
  const error = param(params, 'error');
  const notice = param(params, 'notice');
  const signedIn = await isSignedIn();
  // Saved for later (p10-21): on the account, so signed-in shoppers only.
  const saved = signedIn ? await api<SavedItem[]>('/me/saved').catch((): SavedItem[] => []) : [];
  const sv = await getT('saved');
  const tc = await getT('cart');
  const to = await getT('order');
  const bd = await getT('bundles');
  const cl = await getT('clips');
  const tCommon = await getT('common');
  const tp = await getT('product');
  const f = await getFormat();
  const locale = await getLocale();

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="wrap section">
        <h1>{tc('title')}</h1>
        {error ? <p className="banner banner--error">{error}</p> : null}
        {notice ? (
          <p className="banner banner--ok" role="status">
            {notice}
          </p>
        ) : null}
        <div className="empty card" style={{ marginTop: 20 }}>
          <p>{tc('empty')}</p>
          <p style={{ marginTop: 12 }}>
            <Link className="btn btn--primary" href="/search">
              {tc('browseProducts')}
            </Link>
          </p>
        </div>
        <SavedForLater items={saved} />
      </div>
    );
  }

  const blocked = cart.lines.some((line) => line.problem);
  const t = cart.totals;
  const threshold = t.subtotalCents + t.freeShippingRemainingCents;

  return (
    <div className="wrap section">
      <h1>{tc('title')}</h1>
      <p className="muted" style={{ margin: '6px 0 20px' }}>
        {tCommon('cartItems', { count: cart.itemCount })}
      </p>
      {error ? (
        <p className="banner banner--error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="banner banner--ok" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </p>
      ) : null}

      <div className="cart">
        <section aria-label={tc('items')}>
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
                <PlusLineTag line={line} />
                {line.problem === 'UNAVAILABLE' ? (
                  <p className="field-error">{tc('unavailable')}</p>
                ) : line.problem === 'INSUFFICIENT_STOCK' ? (
                  <p className="field-error">{tc('lowStock', { count: line.available })}</p>
                ) : null}
                <div className="cart-line__actions">
                  <form action={updateLine} className="cart-line__actions" style={{ margin: 0 }}>
                    <input type="hidden" name="variantId" value={line.variantId} />
                    <label className="check" style={{ gap: 6 }}>
                      {tc('qty')}
                      <select
                        name="quantity"
                        defaultValue={line.quantity}
                        aria-label={tc('quantityOf', { title: line.productTitle })}
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
                      {tc('update')}
                    </button>
                  </form>
                  <form action={updateLine} style={{ margin: 0 }}>
                    <input type="hidden" name="variantId" value={line.variantId} />
                    <input type="hidden" name="quantity" value="0" />
                    <button className="btn btn--link" type="submit">
                      {tCommon('remove')}
                    </button>
                  </form>
                  {signedIn ? (
                    <form action={saveForLater} style={{ margin: 0 }}>
                      <input type="hidden" name="variantId" value={line.variantId} />
                      <button className="btn btn--link" type="submit">
                        {sv('saveForLater')}
                      </button>
                    </form>
                  ) : (
                    <Link
                      className="btn btn--link"
                      href="/account/login?next=%2Fcart"
                      title={sv('signInToSave')}
                    >
                      {sv('saveForLater')}
                    </Link>
                  )}
                </div>
              </div>
              <div className="num">
                <strong>{f.money(line.lineTotalCents)}</strong>
                {line.quantity > 1 ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    {rich(tc('eachPrice'), {
                      price: () => (
                        <Price
                          key="price"
                          cents={line.unitPriceCents}
                          locale={INTL_LOCALE[locale]}
                          wasLabel={tp('was')}
                        />
                      ),
                    })}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        <aside className="card summary" aria-label={to('orderSummary')}>
          <h2>{to('summary')}</h2>
          <dl>
            <dt>{to('subtotal')}</dt>
            <dd>{f.money(t.subtotalCents)}</dd>
            {t.bundleDiscountCents ? (
              <>
                <dt>{bd('savings')}</dt>
                <dd className="discount">−{f.money(t.bundleDiscountCents)}</dd>
              </>
            ) : null}
            {t.clipDiscountCents ? (
              <>
                <dt>{cl('savings')}</dt>
                <dd className="discount">−{f.money(t.clipDiscountCents)}</dd>
              </>
            ) : null}
            {t.discountCents - (t.bundleDiscountCents ?? 0) - (t.clipDiscountCents ?? 0) ? (
              <>
                <dt>{to('discountWithCode', { code: cart.coupon?.code ?? '' })}</dt>
                <dd className="discount">
                  −
                  {f.money(
                    t.discountCents - (t.bundleDiscountCents ?? 0) - (t.clipDiscountCents ?? 0),
                  )}
                </dd>
              </>
            ) : null}
            <dt>{to('shipping')}</dt>
            <dd>
              <ShippingAmount totals={t} />
            </dd>
            <dt>{to('tax')}</dt>
            <dd className="muted">{tc('atCheckout')}</dd>
            <dt className="total">{tc('estimatedTotal')}</dt>
            <dd className="total">
              {f.money(t.subtotalCents - t.discountCents + t.shippingCents)}
            </dd>
          </dl>
          {cart.clippedCoupons?.length ? (
            <ul className="bundle-lines">
              {cart.clippedCoupons.map((c) => (
                <li key={c.id}>
                  {cl('cartLine', { product: c.productTitle })} · −{f.money(c.discountCents)}
                </li>
              ))}
            </ul>
          ) : null}
          {cart.bundles?.length ? (
            <ul className="bundle-lines">
              {cart.bundles.map((b) => (
                <li key={b.id}>
                  {bd('cartLine', { title: b.title })}
                  {b.sets > 1 ? ` · ${bd('cartSets', { count: b.sets })}` : ''} · −
                  {f.money(b.discountCents)}
                </li>
              ))}
            </ul>
          ) : null}
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
                {tCommon('remove')}
              </button>
            </form>
          ) : (
            <form action={applyCoupon} className="coupon">
              <input
                name="code"
                placeholder={tc('discountCode')}
                aria-label={tc('discountCode')}
                maxLength={32}
                required
              />
              <button className="btn btn--secondary btn--sm" type="submit">
                {tc('apply')}
              </button>
            </form>
          )}
          {t.shippingWaivedCents !== undefined ? null : t.freeShippingRemainingCents > 0 ? (
            <div className="free-ship">
              <progress
                value={t.subtotalCents}
                max={threshold}
                aria-label={tc('freeShippingProgress')}
              />
              <span>
                {tc('addForFreeShipping', { amount: f.money(t.freeShippingRemainingCents) })}
              </span>
            </div>
          ) : (
            <p className="free-ship">{tc('gotFreeShipping')}</p>
          )}
          <PlusShippingNote totals={t} signedIn={signedIn} />
          <DeliveryPromise window={cart.delivery} twoDay={t.shippingSpeed === 'TWO_DAY'} />
          {blocked || cart.coupon?.problem ? (
            <p className="banner banner--info">{blocked ? tc('fixItems') : tc('removeCode')}</p>
          ) : (
            <Link className="btn btn--primary btn--block" href="/checkout">
              {tc('checkOut')}
            </Link>
          )}
          <Link href="/search" className="muted" style={{ textAlign: 'center', fontSize: 14 }}>
            {tc('continueShopping')}
          </Link>
        </aside>
      </div>
      <SavedForLater items={saved} />
    </div>
  );
}
