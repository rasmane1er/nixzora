import {
  type Cart,
  CartIdSchema,
  codeDiscountCents,
  type GiftBalanceView,
  type MeResponse,
  type PaymentCardView,
  type SavedAddress,
} from '@nixzora/validation';
import { calendarDay } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, currentCart } from '@/lib/api';
import { DeliveryPromise } from '@/components/DeliveryPromise';
import { PlusLineTag, PlusShippingNote, ShippingAmount } from '@/components/PlusNotes';
import { getFormat, getLocale, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { accessToken } from '@/lib/session';
import { CheckoutForm } from './CheckoutForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('checkout');
  return { title: t('title'), robots: { index: false } };
}

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Buy now (p10-05): a one-item cart of its own, from the product page.
  const buy = CartIdSchema.safeParse(param(params, 'buy'));
  const from = param(params, 'from');
  const back = from && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(from) ? `/p/${from}` : '/';
  const buyNowId = buy.success ? buy.data : undefined;
  const cart = buyNowId
    ? await api<Cart>(`/cart/buy-now/${buyNowId}`).catch(() => null)
    : await currentCart();
  if (!cart || cart.lines.length === 0) redirect(buyNowId ? back : '/cart');
  if (!buyNowId && (cart.lines.some((line) => line.problem) || cart.coupon?.problem)) {
    redirect('/cart');
  }
  const l = await getT('lists');

  const signedIn = Boolean(await accessToken());
  const [me, addresses, cards, gift] = signedIn
    ? await Promise.all([
        api<MeResponse>('/auth/me').catch(() => null),
        api<SavedAddress[]>('/me/addresses').catch(() => []),
        api<PaymentCardView[]>('/me/payment-cards').catch((): PaymentCardView[] => []),
        api<GiftBalanceView>('/me/gift-cards').catch(() => null),
      ])
    : [null, [] as SavedAddress[], [] as PaymentCardView[], null];

  const t = cart.totals;
  const tc = await getT('checkout');
  const to = await getT('order');
  const bd = await getT('bundles');
  const mb = await getT('multiBuy');
  const sp = await getT('spendSave');
  const po = await getT('preorders');
  const locale = await getLocale();
  const cl = await getT('clips');
  const f = await getFormat();
  return (
    <div className="wrap section">
      <p className="eyebrow">{tc('secureCheckout')}</p>
      <h1 style={{ marginBottom: 20 }}>{tc('whereToSend')}</h1>
      <div className="cart">
        <CheckoutForm
          email={me?.email}
          signedIn={Boolean(me)}
          addresses={addresses}
          buyNowId={buyNowId}
          cards={cards}
          giftBalanceCents={gift?.balanceCents ?? 0}
          giftWrapCents={cart.giftWrap?.priceCents ?? null}
        />
        <aside className="card summary" aria-label={to('orderSummary')}>
          <h2>{tc('yourOrder')}</h2>
          {buyNowId ? <p className="muted">{l('buyNowNote')}</p> : null}
          <ul className="mini-lines">
            {cart.lines.map((line) => (
              <li key={line.variantId}>
                <span>
                  {line.quantity} × {line.productTitle}
                  <span className="muted"> · {line.variantTitle}</span>
                  {line.releaseDate ? (
                    <span className="line-preorder">
                      {' '}
                      · {po('cartLine', { date: calendarDay(line.releaseDate, locale) })}
                    </span>
                  ) : null}
                  <PlusLineTag line={line} />
                </span>
                <span>{f.money(line.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
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
            <dd className="muted">{tc('nextStep')}</dd>
          </dl>
          <PlusShippingNote totals={t} signedIn={signedIn} />
          <DeliveryPromise window={cart.delivery} twoDay={t.shippingSpeed === 'TWO_DAY'} />
          {buyNowId ? (
            <Link href={back} className="muted" style={{ fontSize: 14 }}>
              {l('backToProduct')}
            </Link>
          ) : (
            <Link href="/cart" className="muted" style={{ fontSize: 14 }}>
              {tc('editCart')}
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
