import { type AccountOverview } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountIcon, type AccountIconName } from '@/components/AccountIcon';
import { AccountOrderCard, BuyAgainCard } from '@/components/AccountOrderCard';
import { Notices } from '@/components/AccountHeader';
import { Avatar } from '@/components/Avatar';
import { accountApi } from '@/lib/account';
import { param, type SearchParams } from '@/lib/params';
import { signOut } from './actions';
import { resendVerification } from './hub-actions';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

type Item = {
  href: string;
  icon: AccountIconName;
  label: string;
  hint?: string;
  badge?: string | null;
};
type Group = { title: string; items: Item[] };

function MenuGroup({ group }: { group: Group }) {
  return (
    <section className="menu-group" aria-labelledby={`g-${group.title}`}>
      <h2 id={`g-${group.title}`} className="menu-group__title">
        {group.title}
      </h2>
      <ul>
        {group.items.map((item) => (
          <li key={item.href + item.label}>
            <Link href={item.href} className="menu-row">
              <span className="menu-row__icon">
                <AccountIcon name={item.icon} size={22} />
              </span>
              <span className="menu-row__text">
                <span>{item.label}</span>
                {item.hint ? <span className="muted">{item.hint}</span> : null}
              </span>
              {item.badge ? <span className="account-tile__badge">{item.badge}</span> : null}
              <span className="menu-row__chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Your Account: a profile header, then everything about orders, shopping, security and help. */
export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const o = await accountApi<AccountOverview>('/me/overview', '/account');
  const { counts, profile, security } = o;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const since = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(profile.memberSince),
  );

  const groups: Group[] = [
    {
      title: 'Orders',
      items: [
        {
          href: '/account/orders',
          icon: 'orders',
          label: 'Your orders',
          hint: `${counts.orders} ${counts.orders === 1 ? 'order' : 'orders'}`,
        },
        {
          href: '/account/orders?filter=open',
          icon: 'track',
          label: 'Track a package',
          badge: counts.openOrders ? `${counts.openOrders} on the way` : null,
        },
        {
          href: '/account/returns',
          icon: 'returns',
          label: 'Returns & refunds',
          badge: counts.openReturns ? `${counts.openReturns} in progress` : null,
        },
        {
          href: '/account/wishlist',
          icon: 'wishlist',
          label: 'Wishlist',
          hint: counts.wishlist ? `${counts.wishlist} saved` : undefined,
        },
        { href: '/account/buy-again', icon: 'buyAgain', label: 'Buy again' },
        {
          href: '/account/reviews',
          icon: 'reviews',
          label: 'Your reviews',
          badge: counts.toReview ? `${counts.toReview} to review` : null,
        },
      ],
    },
    {
      title: 'Shopping & payments',
      items: [
        {
          href: '/account/addresses',
          icon: 'addresses',
          label: 'Addresses',
          hint: counts.addresses ? `${counts.addresses} saved` : 'Home, work and more',
        },
        { href: '/account/payments', icon: 'payment', label: 'Payment methods' },
        { href: '/account/coupons', icon: 'coupon', label: 'Coupons & promotions' },
        o.seller
          ? { href: '/sell', icon: 'store', label: 'Your store', hint: o.seller.displayName }
          : { href: '/sell', icon: 'store', label: 'Sell on NIXZORA' },
      ],
    },
    {
      title: 'Account & security',
      items: [
        {
          href: '/account/security',
          icon: 'security',
          label: 'Password & security',
          hint: security.mfaEnabled ? 'Two-step verification on' : undefined,
          badge: security.mfaEnabled ? null : 'Turn on two-step',
        },
        { href: '/account/preferences', icon: 'preferences', label: 'Notifications' },
        { href: '/account/privacy', icon: 'privacy', label: 'Privacy & your data' },
        {
          href: '/account/settings',
          icon: 'settings',
          label: 'Settings',
          hint: 'Appearance, language',
        },
      ],
    },
    {
      title: 'Help & support',
      items: [
        { href: '/help', icon: 'help', label: 'Help center & FAQ' },
        { href: '/help/contact', icon: 'chat', label: 'Contact support' },
        { href: '/help/contact?topic=PROBLEM', icon: 'flag', label: 'Report a problem' },
        { href: '/account/support', icon: 'document', label: 'Your support requests' },
      ],
    },
    {
      title: 'About',
      items: [
        { href: '/about', icon: 'info', label: 'About NIXZORA' },
        { href: '/policies/shipping', icon: 'track', label: 'Shipping policy' },
        { href: '/policies/returns', icon: 'returns', label: 'Return policy' },
        { href: '/terms', icon: 'document', label: 'Terms & conditions' },
        { href: '/privacy', icon: 'privacy', label: 'Privacy policy' },
      ],
    },
  ];

  return (
    <div className="wrap section stack" style={{ gap: 24 }}>
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      {!profile.emailVerified ? (
        <form action={resendVerification} className="banner banner--info account-banner">
          <span>Confirm your email address to keep your account secure.</span>
          <button className="btn btn--secondary btn--sm" type="submit">
            Send the link again
          </button>
        </form>
      ) : null}

      <div className="account-layout">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card profile-card" aria-label="Your profile">
            <Avatar url={profile.avatarUrl} name={name} email={profile.email} />
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <h1 className="profile-card__name">{name || 'Your account'}</h1>
              <span className="muted profile-card__line">{profile.email}</span>
              {profile.phone ? (
                <span className="muted profile-card__line">{profile.phone}</span>
              ) : null}
              <span className="profile-card__member">
                <span className="pill pill--delivered">Member</span> since {since}
              </span>
            </div>
            <Link className="btn btn--secondary btn--sm profile-card__edit" href="/account/profile">
              Edit profile
            </Link>
          </section>

          <ul className="account-stats account-stats--compact" aria-label="At a glance">
            <li>
              <Link href="/account/orders?filter=open">
                <strong>{counts.openOrders}</strong>
                <span>On the way</span>
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

          <nav className="menu" aria-label="Your account">
            {groups.map((group) => (
              <MenuGroup key={group.title} group={group} />
            ))}
            <form action={signOut} className="menu-group">
              <button type="submit" className="menu-row menu-row--signout">
                <span className="menu-row__icon">
                  <AccountIcon name="signout" size={22} />
                </span>
                <span className="menu-row__text">
                  <span>Sign out</span>
                </span>
              </button>
            </form>
          </nav>
        </div>

        <div className="stack" style={{ gap: 20 }}>
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
                <Link href="/account/buy-again">See all →</Link>
              </div>
              <div className="buy-again-row">
                {o.buyAgain.map((item) => (
                  <BuyAgainCard key={item.productId} item={item} back="/account" />
                ))}
              </div>
            </section>
          ) : null}

          <p className="muted" style={{ fontSize: 13 }}>
            Signed in on {security.activeSessions}{' '}
            {security.activeSessions === 1 ? 'device' : 'devices'}.{' '}
            <Link href="/account/security#devices">Review devices →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
