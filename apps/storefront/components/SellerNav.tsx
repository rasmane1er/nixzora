import { type SellerView } from '@nixzora/validation';
import Link from 'next/link';
import { SELLER_STATUS_LABEL } from '@/lib/sell';

const LINKS = [
  { href: '/sell', label: 'Overview' },
  { href: '/sell/orders', label: 'Orders' },
  { href: '/sell/feedback', label: 'Returns & ratings' },
  { href: '/sell/listings', label: 'Listings' },
  { href: '/sell/analytics', label: 'Analytics' },
  { href: '/sell/earnings', label: 'Earnings' },
  { href: '/sell/settings', label: 'Store settings' },
];

/** Header of every seller-portal page: store name, status and sections. */
export function SellerNav({
  seller,
  current,
}: {
  seller: SellerView;
  current: (typeof LINKS)[number]['href'];
}) {
  return (
    <div className="seller-head">
      <div className="stack" style={{ gap: 4 }}>
        <p className="eyebrow">Seller portal</p>
        <h1>{seller.displayName}</h1>
        <p className="muted" style={{ fontSize: 14 }}>
          <span className={`pill pill--seller-${seller.status.toLowerCase()}`}>
            {SELLER_STATUS_LABEL[seller.status]}
          </span>{' '}
          {seller.status === 'ACTIVE' ? (
            <Link href={`/s/${seller.handle}`}>View your store →</Link>
          ) : (
            <span className="mono">nixzora.com/s/{seller.handle}</span>
          )}
        </p>
      </div>
      <nav className="seller-tabs" aria-label="Seller portal">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.href === current ? 'page' : undefined}
          >
            {link.label}
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
