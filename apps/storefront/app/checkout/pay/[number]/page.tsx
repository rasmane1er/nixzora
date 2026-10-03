import { type OrderView, type PaymentSession } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AddressBlock, OrderItems, OrderTotals } from '@/components/OrderSummary';
import { api, ApiError } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { PayForm } from './PayForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('checkout');
  return { title: t('paymentTitle'), robots: { index: false } };
}

type Props = { params: Promise<{ number: string }>; searchParams: SearchParams };

export default async function PayPage({ params, searchParams }: Props) {
  const { number } = await params;
  const token = param(await searchParams, 'token');
  if (!/^NX-[A-Z0-9]{6}$/.test(number)) notFound();
  const qs = token ? `?token=${encodeURIComponent(token)}` : '';

  let order: OrderView;
  let session: PaymentSession;
  try {
    order = await api<OrderView>(`/orders/${number}${qs}`);
    session = await api<PaymentSession>(`/orders/${number}/payment${qs}`, { method: 'POST' });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ORDER_NOT_PAYABLE')
      redirect(`/orders/${number}${qs}`);
    if (error instanceof ApiError && error.status === 409) {
      // Stock ran out while the customer was away.
      redirect(`/cart?error=${encodeURIComponent(error.message)}`);
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
  const returnPath = `/orders/${number}${qs || '?'}`;
  const t = await getT('checkout');
  const to = await getT('order');

  return (
    <div className="wrap section">
      <p className="eyebrow">{to('orderNumber', { number: order.number })}</p>
      <h1 style={{ marginBottom: 20 }}>{t('paymentTitle')}</h1>
      <div className="cart">
        <section className="card stack">
          <PayForm session={session} returnPath={returnPath} />
          <p className="muted" style={{ fontSize: 13 }}>
            {t('heldNotice')}
          </p>
        </section>
        <aside className="card summary" aria-label={to('orderSummary')}>
          <h2>{to('summary')}</h2>
          <OrderItems order={order} />
          <OrderTotals order={order} />
          <div className="stack" style={{ gap: 4 }}>
            <strong>{to('shippingTo')}</strong>
            <AddressBlock address={order.shippingAddress} />
          </div>
          <Link href="/cart" className="muted" style={{ fontSize: 14 }}>
            {t('changeSomething')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
