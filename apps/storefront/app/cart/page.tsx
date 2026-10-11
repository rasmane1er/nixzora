import { calendarDay, INTL_LOCALE, multiBuyAddMore, multiBuyTerms, rich } from '@nixzora/i18n';
import { Price } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { api, currentCart } from '@/lib/api';
import { DeliveryPromise } from '@/components/DeliveryPromise';
import { PlusLineTag, PlusShippingNote, ShippingAmount } from '@/components/PlusNotes';
import { isSignedIn } from '@/lib/session';
import { getFormat, getLocale, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { codeDiscountCents, type ReferralView, type SavedItem } from '@nixzora/validation';
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
  // Refer a friend (p10-23): a welcome code not used yet, offered while no code is applied.
  const welcome = signedIn
    ? await api<{ welcome: ReferralView['welcome'] }>('/me/referral/welcome')
        .then((r) => r.welcome)
        .catch(() => null)
    : null;
  const rf = await getT('referrals');
  const tc = await getT('cart');
  const to = await getT('order');
  const bd = await getT('bundles');
  const mb = await getT('multiBuy');
  const sp = await getT('spendSave');
  const po = await getT('preorders');
  const vac = await getT('vacation');
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
  const releases = cart.lines.map((line) => line.releaseDate).filter((d): d is string => !!d);
  const mixedRelease =
    releases.length && releases.length < cart.lines.length ? releases.sort().at(-1)! : null;
  const t = cart.totals;
  const threshold = t.subtotalCents + t.freeShippingRemainingCents;
  const tu = await getT('shopUi');
  const estimated = t.subtotalCents - t.discountCents + t.shippingCents;
  // What the shopper keeps (ADR-0053): list-price markdowns, member prices and every discount.
  const saving =
    cart.lines.reduce(
      (sum, l) =>
        sum +
        Math.max(0, Math.max(l.compareAtCents ?? 0, l.regularPriceCents ?? 0) - l.unitPriceCents) *
          l.quantity,
      0,
    ) + t.discountCents;
  const canCheckOut = !(blocked || cart.coupon?.problem);

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
      {welcome && !welcome.used && !cart.coupon ? (
        <form action={applyCoupon} className="banner banner--ok welcome-banner">
          <input type="hidden" name="code" value={welcome.code} />
          <span>
            {rf('cartBanner', { amount: f.money(welcome.amountCents), code: welcome.code })}
          </span>
          <button className="btn btn--secondary btn--sm" type="submit">
            {rf('apply')}
          </button>
        </form>
      ) : null}

      <div className="cart">
        <section aria-label={tc('items')}>
          {/* Pre-orders (p10-30): one order ships once, so a pre-order holds up the rest. */}
          {mixedRelease ? (
            <p className="banner banner--info">
              {po('cartMixed', { date: calendarDay(mixedRelease, locale) })}
            </p>
          ) : null}
          {/* Spend more, save more (p10-31): what each store's tiers saved, or how far the next is. */}
          {cart.spendOffers?.map((s) => {
            const store = s.seller?.displayName ?? sp('nixzora');
            return (
              <p key={s.id} className="banner banner--info cart-spend">
                <span className="card-offer">{sp('title')}</span>{' '}
                {s.discountCents ? sp('reached', { off: f.money(s.discountCents), store }) : null}{' '}
                {s.next
                  ? sp('more', {
                      amount: f.money(s.next.moreCents),
                      store,
                      off: f.money(s.next.offCents),
                    })
                  : null}{' '}
                {s.seller && s.next ? (
                  <Link href={`/s/${s.seller.handle}`}>{sp('shopStore', { store })} →</Link>
                ) : null}
              </p>
            );
          })}
          {/* Buy X, get Y (p10-27): a few more items would get the reward. */}
          {cart.multiBuys
            ?.filter((m) => m.addMore)
            .map((m) => (
              <p key={m.id} className="banner banner--info cart-offer-nudge">
                <span className="card-offer">{multiBuyTerms(mb, m)}</span> {multiBuyAddMore(mb, m)}{' '}
                <Link href={`/offers/${m.id}`}>{mb('shopOffer')} →</Link>
              </p>
            ))}
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
                {line.releaseDate ? (
                  <div className="line-preorder">
                    {po('cartLine', { date: calendarDay(line.releaseDate, locale) })}
                  </div>
                ) : null}
                <PlusLineTag line={line} />
                {line.storeAway ? (
                  // Vacation mode (p10-32): it waits in the cart until the store is back.
                  <p className="field-error">
                    {line.storeAway.until
                      ? vac('cartLine', {
                          store: line.storeAway.store,
                          date: calendarDay(line.storeAway.until, locale),
                        })
                      : vac('cartLineOpen', { store: line.storeAway.store })}
                  </p>
                ) : line.problem === 'UNAVAILABLE' ? (
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
            {t.multiBuyDiscountCents ? (
              <>
                <dt>{mb('savings')}</dt>
                <dd className="discount">−{f.money(t.multiBuyDiscountCents)}</dd>
              </>
            ) : null}
            {t.spendDiscountCents ? (
              <>
                <dt>{sp('savings')}</dt>
                <dd className="discount">−{f.money(t.spendDiscountCents)}</dd>
              </>
            ) : null}
            {t.clipDiscountCents ? (
              <>
                <dt>{cl('savings')}</dt>
                <dd className="discount">−{f.money(t.clipDiscountCents)}</dd>
              </>
            ) : null}
            {codeDiscountCents(t) ? (
              <>
                <dt>{to('discountWithCode', { code: cart.coupon?.code ?? '' })}</dt>
                <dd className="discount">−{f.money(codeDiscountCents(t))}</dd>
              </>
            ) : null}
            <dt>{to('shipping')}</dt>
            <dd>
              <ShippingAmount totals={t} />
            </dd>
            <dt>{to('tax')}</dt>
            <dd className="muted">{tc('atCheckout')}</dd>
            <dt className="total">{tc('estimatedTotal')}</dt>
            <dd className="total">{f.money(estimated)}</dd>
          </dl>
          {saving > 0 ? (
            <p className="cart-saving">{tu('youSave', { amount: f.money(saving) })}</p>
          ) : null}
          {cart.clippedCoupons?.length ? (
            <ul className="bundle-lines">
              {cart.clippedCoupons.map((c) => (
                <li key={c.id}>
                  {cl('cartLine', { product: c.productTitle })} · −{f.money(c.discountCents)}
                </li>
              ))}
            </ul>
          ) : null}
          {cart.multiBuys?.some((m) => m.discountCents) ? (
            // Buy X, get Y (p10-27): what applied, and what a few more items would get.
            <ul className="bundle-lines">
              {cart.multiBuys
                .filter((m) => m.discountCents)
                .map((m) => (
                  <li key={m.id}>
                    {multiBuyTerms(mb, m)} · −{f.money(m.discountCents)}
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
      {/* Phones (ADR-0053): the total and Check out stay in reach while scrolling the lines. */}
      <div className="cart-bar">
        <div>
          <span className="muted">{tu('total')}</span>
          <strong>{f.money(estimated)}</strong>
        </div>
        {canCheckOut ? (
          <Link className="btn btn--primary" href="/checkout">
            {tc('checkOut')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
