import { type MeResponse, type SavedAddress } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, currentCart } from '@/lib/api';
import { accessToken } from '@/lib/session';
import { CheckoutForm } from './CheckoutForm';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

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
  return (
    <div className="wrap section">
      <p className="eyebrow">Secure checkout</p>
      <h1 style={{ marginBottom: 20 }}>Where should we send it?</h1>
      <div className="cart">
        <CheckoutForm email={me?.email} signedIn={Boolean(me)} addresses={addresses} />
        <aside className="card summary" aria-label="Order summary">
          <h2>Your order</h2>
          <ul className="mini-lines">
            {cart.lines.map((line) => (
              <li key={line.variantId}>
                <span>
                  {line.quantity} × {line.productTitle}
                  <span className="muted"> · {line.variantTitle}</span>
                </span>
                <span>{formatMoney(line.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
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
            <dd className="muted">Next step</dd>
          </dl>
          <Link href="/cart" className="muted" style={{ fontSize: 14 }}>
            ← Edit cart
          </Link>
        </aside>
      </div>
    </div>
  );
}
