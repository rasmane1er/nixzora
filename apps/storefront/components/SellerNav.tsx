import { type SellerView } from '@nixzora/validation';
import Link from 'next/link';
import { getT } from '@/lib/i18n';

const LINKS = [
  { href: '/sell', label: 'navOverview' },
  { href: '/sell/orders', label: 'navOrders' },
  { href: '/sell/feedback', label: 'navFeedback' },
  { href: '/sell/messages', label: 'navMessages' },
  { href: '/sell/questions', label: 'navQuestions' },
  { href: '/sell/listings', label: 'navListings' },
  { href: '/sell/analytics', label: 'navAnalytics' },
  { href: '/sell/earnings', label: 'navEarnings' },
  { href: '/sell/deals', label: 'navDeals' },
  { href: '/sell/bundles', label: 'navBundles' },
  { href: '/sell/multi-buys', label: 'navMultiBuys' },
  { href: '/sell/spend-offers', label: 'navSpendOffers' },
  { href: '/sell/coupons', label: 'navCoupons' },
  { href: '/sell/size-charts', label: 'navSizeCharts' },
  { href: '/sell/ads', label: 'navAds' },
  { href: '/sell/settings', label: 'navSettings' },
] as const;

/** Header of every seller-portal page: store name, status and sections. */
export async function SellerNav({
  seller,
  current,
}: {
  seller: SellerView;
  current: (typeof LINKS)[number]['href'];
}) {
  const t = await getT('sell');
  return (
    <div className="seller-head">
      <div className="stack" style={{ gap: 4 }}>
        <p className="eyebrow">{t('portal')}</p>
        <h1>{seller.displayName}</h1>
        <p className="muted" style={{ fontSize: 14 }}>
          <span className={`pill pill--seller-${seller.status.toLowerCase()}`}>
            {t(`status_${seller.status}`)}
          </span>{' '}
          {seller.status === 'ACTIVE' ? (
            <Link href={`/s/${seller.handle}`}>{t('viewStore')}</Link>
          ) : (
            <span className="mono">nixzora.com/s/{seller.handle}</span>
          )}
        </p>
      </div>
      <nav className="seller-tabs" aria-label={t('portal')}>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.href === current ? 'page' : undefined}
          >
            {t(link.label)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Notices({ notice, error }: { notice?: string; error?: string }) {
  return (
    <>
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="banner banner--ok" role="status">
          {notice}
        </p>
      ) : null}
    </>
  );
}
