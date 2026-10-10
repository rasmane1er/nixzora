import { type MeResponse, type SavedAddress } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, currentCart } from '@/lib/api';
import { DeliveryPromise } from '@/components/DeliveryPromise';
import { getFormat, getT } from '@/lib/i18n';
import { accessToken } from '@/lib/session';
import { CheckoutForm } from './CheckoutForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('checkout');
  return { title: t('title'), robots: { index: false } };
}

export default async function CheckoutPage() {
  const cart = await currentCart();
  if (!cart || cart.lines.length === 0) redirect('/cart');
  if (cart.lines.some((line) => line.problem) || cart.coupon?.problem) redirect('/cart');

  const signedIn = Boolean(await accessToken());
  const [me, addresses] = signedIn
    ? await Promise.all([
        api<MeResponse>('/auth/me').catch(() => null),
        api<SavedAddress[]>('/me/addresses').catch(() => []),
      ])
    : [null, [] as SavedAddress[]];

  const t = cart.totals;
  const tc = await getT('checkout');
  const to = await getT('order');
  const f = await getFormat();
  return (
    <div className="wrap section">
      <p className="eyebrow">{tc('secureCheckout')}</p>
      <h1 style={{ marginBottom: 20 }}>{tc('whereToSend')}</h1>
      <div className="cart">
        <CheckoutForm email={me?.email} signedIn={Boolean(me)} addresses={addresses} />
        <aside className="card summary" aria-label={to('orderSummary')}>
          <h2>{tc('yourOrder')}</h2>
          <ul className="mini-lines">
            {cart.lines.map((line) => (
              <li key={line.variantId}>
                <span>
                  {line.quantity} × {line.productTitle}
                  <span className="muted"> · {line.variantTitle}</span>
                </span>
                <span>{f.money(line.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl>
            <dt>{to('subtotal')}</dt>
            <dd>{f.money(t.subtotalCents)}</dd>
            {t.discountCents ? (
              <>
                <dt>{to('discountWithCode', { code: cart.coupon?.code ?? '' })}</dt>
                <dd className="discount">−{f.money(t.discountCents)}</dd>
              </>
            ) : null}
            <dt>{to('shipping')}</dt>
            <dd>{t.shippingCents ? f.money(t.shippingCents) : to('free')}</dd>
            <dt>{to('tax')}</dt>
            <dd className="muted">{tc('nextStep')}</dd>
          </dl>
          <DeliveryPromise window={cart.delivery} />
          <Link href="/cart" className="muted" style={{ fontSize: 14 }}>
            {tc('editCart')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
