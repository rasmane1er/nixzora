import { rich } from '@nixzora/i18n';
import { type AccountOverview } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountIcon, type AccountIconName } from '@/components/AccountIcon';
import { AccountOrderCard, BuyAgainCard } from '@/components/AccountOrderCard';
import { Notices } from '@/components/AccountHeader';
import { Avatar } from '@/components/Avatar';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { signOut } from './actions';
import { resendVerification } from './hub-actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('account');
  return { title: t('yourAccount'), robots: { index: false } };
}

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
  const [t, tc, f, l] = await Promise.all([
    getT('account'),
    getT('common'),
    getFormat(),
    getT('lists'),
  ]);
  const since = f.monthYear(profile.memberSince);

  const groups: Group[] = [
    {
      title: t('groupOrders'),
      items: [
        {
          href: '/account/orders',
          icon: 'orders',
          label: t('yourOrders'),
          hint: t('ordersCount', { count: counts.orders }),
        },
        {
          href: '/account/orders?filter=open',
          icon: 'track',
          label: t('trackPackage'),
          badge: counts.openOrders ? t('onTheWayCount', { count: counts.openOrders }) : null,
        },
        {
          href: '/account/returns',
          icon: 'returns',
          label: t('returnsRefunds'),
          badge: counts.openReturns ? t('inProgressCount', { count: counts.openReturns }) : null,
        },
        {
          href: '/account/wishlist',
          icon: 'wishlist',
          label: t('wishlist'),
          hint: counts.wishlist ? t('savedCount', { count: counts.wishlist }) : undefined,
        },
        { href: '/account/lists', icon: 'lists', label: l('title') },
        { href: '/account/buy-again', icon: 'buyAgain', label: t('buyAgain') },
        {
          href: '/account/reviews',
          icon: 'reviews',
          label: t('yourReviews'),
          badge: counts.toReview ? t('toReviewCount', { count: counts.toReview }) : null,
        },
      ],
    },
    {
      title: t('groupShopping'),
      items: [
        {
          href: '/account/addresses',
          icon: 'addresses',
          label: t('addresses'),
          hint: counts.addresses
            ? t('savedCount', { count: counts.addresses })
            : t('addressesHint'),
        },
        { href: '/account/payments', icon: 'payment', label: t('paymentMethods') },
        { href: '/account/coupons', icon: 'coupon', label: t('coupons') },
        o.seller
          ? { href: '/sell', icon: 'store', label: t('yourStore'), hint: o.seller.displayName }
          : { href: '/sell', icon: 'store', label: t('sellOnNixzora') },
      ],
    },
    {
      title: t('groupSecurity'),
      items: [
        {
          href: '/account/security',
          icon: 'security',
          label: t('passwordSecurity'),
          hint: security.mfaEnabled ? t('twoStepOnHint') : undefined,
          badge: security.mfaEnabled ? null : t('turnOnTwoStepBadge'),
        },
        { href: '/account/preferences', icon: 'preferences', label: t('notifications') },
        { href: '/account/privacy', icon: 'privacy', label: t('privacyData') },
        {
          href: '/account/settings',
          icon: 'settings',
          label: t('settings'),
          hint: t('settingsHint'),
        },
      ],
    },
    {
      title: t('groupHelp'),
      items: [
        { href: '/help', icon: 'help', label: t('helpCenter') },
        { href: '/help/contact', icon: 'chat', label: t('contactSupport') },
        { href: '/help/contact?topic=PROBLEM', icon: 'flag', label: t('reportProblem') },
        { href: '/account/support', icon: 'document', label: t('supportRequests') },
      ],
    },
    {
      title: t('groupAbout'),
      items: [
        { href: '/about', icon: 'info', label: t('aboutNixzora') },
        { href: '/policies/shipping', icon: 'track', label: t('shippingPolicy') },
        { href: '/policies/returns', icon: 'returns', label: t('returnPolicy') },
        { href: '/terms', icon: 'document', label: t('terms') },
        { href: '/privacy', icon: 'privacy', label: t('privacyPolicy') },
      ],
    },
  ];

  return (
    <div className="wrap section stack" style={{ gap: 24 }}>
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      {!profile.emailVerified ? (
        <form action={resendVerification} className="banner banner--info account-banner">
          <span>{t('confirmEmailBanner')}</span>
          <button className="btn btn--secondary btn--sm" type="submit">
            {t('sendLinkAgain')}
          </button>
        </form>
      ) : null}

      <div className="account-layout">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card profile-card" aria-label={t('yourProfile')}>
            <Avatar url={profile.avatarUrl} name={name} email={profile.email} />
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <h1 className="profile-card__name">{name || t('yourAccount')}</h1>
              <span className="muted profile-card__line">{profile.email}</span>
              {profile.phone ? (
                <span className="muted profile-card__line">{profile.phone}</span>
              ) : null}
              <span className="profile-card__member">
                {rich(t('memberSince', { date: since }), {
                  pill: (chunk) => (
                    <span key="pill" className="pill pill--delivered">
                      {chunk}
                    </span>
                  ),
                })}
              </span>
            </div>
            <Link className="btn btn--secondary btn--sm profile-card__edit" href="/account/profile">
              {t('editProfile')}
            </Link>
          </section>

          <ul className="account-stats account-stats--compact" aria-label={t('atAGlance')}>
            <li>
              <Link href="/account/orders?filter=open">
                <strong>{counts.openOrders}</strong>
                <span>{t('onTheWay')}</span>
              </Link>
            </li>
            <li>
              <Link href="/account/reviews">
                <strong>{counts.toReview}</strong>
                <span>{t('toReview')}</span>
              </Link>
            </li>
            <li>
              <Link href="/account/wishlist">
                <strong>{counts.wishlist}</strong>
                <span>{t('saved')}</span>
              </Link>
            </li>
          </ul>

          <nav className="menu" aria-label={t('yourAccount')}>
            {groups.map((group) => (
              <MenuGroup key={group.title} group={group} />
            ))}
            <form action={signOut} className="menu-group">
              <button type="submit" className="menu-row menu-row--signout">
                <span className="menu-row__icon">
                  <AccountIcon name="signout" size={22} />
                </span>
                <span className="menu-row__text">
                  <span>{tc('signOut')}</span>
                </span>
              </button>
            </form>
          </nav>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <section className="stack" style={{ gap: 14 }}>
            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2>{t('recentOrders')}</h2>
              {counts.orders > o.recentOrders.length ? (
                <Link href="/account/orders">{t('seeAllOrders')}</Link>
              ) : null}
            </div>
            {o.recentOrders.length === 0 ? (
              <div className="card">
                <p className="muted" style={{ margin: 0 }}>
                  {rich(t('noOrders'), {
                    shop: (chunk) => (
                      <Link key="shop" href="/search">
                        {chunk}
                      </Link>
                    ),
                    assistant: (chunk) => (
                      <Link key="assistant" href="/assistant">
                        {chunk}
                      </Link>
                    ),
                  })}
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
                <h2>{t('buyItAgain')}</h2>
                <Link href="/account/buy-again">{t('seeAllArrow')}</Link>
              </div>
              <div className="buy-again-row">
                {o.buyAgain.map((item) => (
                  <BuyAgainCard key={item.productId} item={item} back="/account" />
                ))}
              </div>
            </section>
          ) : null}

          <p className="muted" style={{ fontSize: 13 }}>
            {t('signedInOnDevices', { count: security.activeSessions })}{' '}
            <Link href="/account/security#devices">{t('reviewDevices')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
