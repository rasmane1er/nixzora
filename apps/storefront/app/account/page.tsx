import { type AccountOverview } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountIcon } from '@/components/AccountIcon';
import { AccountOrderCard, BuyAgainCard } from '@/components/AccountOrderCard';
import { Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { param, type SearchParams } from '@/lib/params';
import { signOut } from './actions';
import { resendVerification } from './hub-actions';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

type Tile = {
  href: string;
  icon: Parameters<typeof AccountIcon>[0]['name'];
  title: string;
  text: string;
  badge?: string | null;
};

/** Your Account: the hub for orders, sign-in and security, addresses, lists and data. */
export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const o = await accountApi<AccountOverview>('/me/overview', '/account');
  const { counts, profile, security } = o;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const since = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(profile.memberSince),
  );
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  const tiles: Tile[] = [
    {
      href: '/account/orders',
      icon: 'orders',
      title: 'Your orders',
      text: 'Track packages, return items, buy again',
      badge: counts.openOrders ? `${counts.openOrders} on the way` : null,
    },
    {
      href: '/account/security',
      icon: 'security',
      title: 'Login & security',
      text: 'Name, phone, password, two-step verification, devices',
      badge: security.mfaEnabled ? null : 'Add two-step verification',
    },
    {
      href: '/account/addresses',
      icon: 'addresses',
      title: 'Your addresses',
      text: counts.addresses
        ? `${plural(counts.addresses, 'saved address', 'saved addresses')}; set your default`
        : 'Add an address for faster checkout',
    },
    {
      href: '/account/returns',
      icon: 'returns',
      title: 'Returns & refunds',
      text: '30-day returns: follow a return and its refund',
      badge: counts.openReturns ? `${counts.openReturns} in progress` : null,
    },
    {
      href: '/account/reviews',
      icon: 'reviews',
      title: 'Your reviews',
      text: counts.reviews ? plural(counts.reviews, 'review') + ' written' : 'Share what you think',
      badge: counts.toReview ? `${plural(counts.toReview, 'product')} to review` : null,
    },
    {
      href: '/account/wishlist',
      icon: 'wishlist',
      title: 'Your wishlist',
      text: counts.wishlist ? plural(counts.wishlist, 'saved item') : 'Save products for later',
    },
    {
      href: '/account/preferences',
      icon: 'preferences',
      title: 'Communication',
      text: 'Choose which emails you get from us',
    },
    {
      href: '/account/privacy',
      icon: 'privacy',
      title: 'Your data & privacy',
      text: 'Download your data or close your account',
    },
    o.seller
      ? {
          href: '/sell',
          icon: 'store',
          title: 'Your store',
          text: `Manage ${o.seller.displayName}: orders, listings, earnings`,
        }
      : {
          href: '/sell',
          icon: 'store',
          title: 'Sell on NIXZORA',
          text: 'Open a store and reach new customers',
        },
  ];

  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div className="stack" style={{ gap: 6 }}>
          <p className="eyebrow">Your account</p>
          <h1>{profile.firstName ? `Hello, ${profile.firstName}` : 'Hello'}</h1>
          <p className="muted">
            {name ? `${name} · ` : ''}
            {profile.email} · Customer since {since}
          </p>
        </div>
        <form action={signOut}>
          <button className="btn btn--secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      {!profile.emailVerified ? (
        <form action={resendVerification} className="banner banner--info account-banner">
          <span>Confirm your email address to keep your account secure.</span>
          <button className="btn btn--secondary btn--sm" type="submit">
            Send the link again
          </button>
        </form>
      ) : null}
      {!profile.firstName ? (
        <p className="banner banner--info">
          Add your name so we can greet you properly.{' '}
          <Link href="/account/security">Add it in Login &amp; security →</Link>
        </p>
      ) : null}

      <ul className="account-stats" aria-label="At a glance">
        <li>
          <Link href="/account/orders?filter=open">
            <strong>{counts.openOrders}</strong>
            <span>On the way</span>
          </Link>
        </li>
        <li>
          <Link href="/account/orders">
            <strong>{counts.orders}</strong>
            <span>{counts.orders === 1 ? 'Order' : 'Orders'}</span>
          </Link>
        </li>
        <li>
          <Link href="/account/reviews">
            <strong>{counts.toReview}</strong>
            <span>To review</span>
          </Link>
        </li>
        <li>
          <Link href="/account/wishlist">
            <strong>{counts.wishlist}</strong>
            <span>Saved</span>
          </Link>
        </li>
      </ul>

      <ul className="account-tiles">
        {tiles.map((tile) => (
          <li key={tile.href + tile.title}>
            <Link href={tile.href} className="account-tile">
              <span className="account-tile__icon">
                <AccountIcon name={tile.icon} />
              </span>
              <span className="stack" style={{ gap: 4 }}>
                <strong>{tile.title}</strong>
                <span className="muted">{tile.text}</span>
                {tile.badge ? <span className="account-tile__badge">{tile.badge}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="stack" style={{ gap: 14 }}>
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2>Recent orders</h2>
          {counts.orders > o.recentOrders.length ? (
            <Link href="/account/orders">See all orders →</Link>
          ) : null}
        </div>
        {o.recentOrders.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              No orders yet. <Link href="/search">Start shopping →</Link> or{' '}
              <Link href="/assistant">ask the assistant</Link> what to get.
            </p>
          </div>
        ) : (
          o.recentOrders.map((order) => (
            <AccountOrderCard key={order.id} order={order} back="/account" />
          ))
        )}
      </section>

      {o.buyAgain.length ? (
        <section className="stack" style={{ gap: 14 }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <h2>Buy it again</h2>
            <Link href="/account/orders?filter=delivered">Past purchases →</Link>
          </div>
          <div className="buy-again-row">
            {o.buyAgain.map((item) => (
              <BuyAgainCard key={item.productId} item={item} back="/account" />
            ))}
          </div>
        </section>
      ) : null}

      <p className="muted" style={{ fontSize: 13 }}>
        {security.mfaEnabled ? 'Two-step verification is on. ' : ''}
        Signed in on {plural(security.activeSessions, 'device')}.{' '}
        <Link href="/account/security#devices">Review devices →</Link>
      </p>
    </div>
  );
}
