import { type OrderView, type PaymentSession } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AddressBlock, OrderItems, OrderTotals } from '@/components/OrderSummary';
import { api, ApiError } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';
import { PayForm } from './PayForm';

export const metadata: Metadata = { title: 'Payment', robots: { index: false } };

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

  return (
    <div className="wrap section">
      <p className="eyebrow">Order {order.number}</p>
      <h1 style={{ marginBottom: 20 }}>Payment</h1>
      <div className="cart">
        <section className="card stack">
          <PayForm session={session} returnPath={returnPath} />
          <p className="muted" style={{ fontSize: 13 }}>
            Your items are held for you for 15 minutes while you pay.
          </p>
        </section>
        <aside className="card summary" aria-label="Order summary">
          <h2>Summary</h2>
          <OrderItems order={order} />
          <OrderTotals order={order} />
          <div className="stack" style={{ gap: 4 }}>
            <strong>Shipping to</strong>
            <AddressBlock address={order.shippingAddress} />
          </div>
          <Link href="/cart" className="muted" style={{ fontSize: 14 }}>
            Need to change something? Start again from your cart.
          </Link>
        </aside>
      </div>
    </div>
  );
}
