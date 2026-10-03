import { type MeResponse, type OrderSummary, type SavedAddress } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusPill } from '@/components/OrderSummary';
import { api, ApiError } from '@/lib/api';
import { deleteAddress, signOut } from './actions';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

export default async function AccountPage() {
  let me: MeResponse;
  let orders: OrderSummary[];
  let addresses: SavedAddress[];
  try {
    [me, orders, addresses] = await Promise.all([
      api<MeResponse>('/auth/me'),
      api<OrderSummary[]>('/me/orders'),
      api<SavedAddress[]>('/me/addresses'),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect('/account/login?next=/account');
    }
    throw error;
  }
  const date = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));

  return (
    <div className="wrap section stack" style={{ gap: 24 }}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div className="stack" style={{ gap: 6 }}>
          <p className="eyebrow">Your account</p>
          <h1>Hi{me.firstName ? `, ${me.firstName}` : ''}</h1>
          <p className="muted">{me.email}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link className="btn btn--secondary" href="/account/wishlist">
            Wishlist
          </Link>
          <form action={signOut}>
            <button className="btn btn--secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {!me.emailVerified ? (
        <p className="banner banner--info">Check your inbox to confirm your email address.</p>
      ) : null}

      <section className="card stack">
        <h2>Orders</h2>
        {orders.length === 0 ? (
          <p className="muted">
            No orders yet. <Link href="/search">Start shopping →</Link>
          </p>
        ) : (
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/orders/${order.number}`} className="mono">
                        {order.number}
                      </Link>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                      </div>
                    </td>
                    <td>{date(order.placedAt ?? order.createdAt)}</td>
                    <td>
                      <StatusPill status={order.status} />
                    </td>
                    <td className="num">{formatMoney(order.totalCents, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>Addresses</h2>
        {addresses.length === 0 ? (
          <p className="muted">Addresses you save at checkout appear here.</p>
        ) : (
          <div className="tiles">
            {addresses.map((address) => (
              <div key={address.id} className="tile" style={{ cursor: 'default' }}>
                <strong>
                  {address.label ?? (address.isDefaultShipping ? 'Default' : 'Saved')}
                </strong>
                <span className="muted">
                  {address.fullName}
                  <br />
                  {address.line1}
                  <br />
                  {address.city}, {address.region} {address.postalCode}
                </span>
                <form action={deleteAddress}>
                  <input type="hidden" name="id" value={address.id} />
                  <button className="btn btn--link" type="submit">
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
