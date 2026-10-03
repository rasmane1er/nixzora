import { type AccountCoupon } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi, day } from '@/lib/account';

export const metadata: Metadata = { title: 'Coupons & promotions', robots: { index: false } };

function amount(c: AccountCoupon): string {
  return c.type === 'PERCENT' ? `${c.value / 100}% off` : `${formatMoney(c.value, 'USD')} off`;
}

export default async function CouponsPage() {
  const coupons = await accountApi<AccountCoupon[]>('/me/coupons', '/account/coupons');
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title="Coupons & promotions"
        description="Enter a code in your cart. One code per order."
      />
      {coupons.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>No promotions right now. Check back soon.</p>
        </div>
      ) : (
        <ul className="coupon-list">
          {coupons.map((c) => (
            <li key={c.code} className={`coupon${c.used ? ' coupon--used' : ''}`}>
              <div className="coupon__value">{amount(c)}</div>
              <div className="stack" style={{ gap: 4 }}>
                <strong>{c.description ?? amount(c)}</strong>
                <span className="muted" style={{ fontSize: 14 }}>
                  {c.minSubtotalCents
                    ? `On orders of ${formatMoney(c.minSubtotalCents, 'USD')} or more`
                    : 'No minimum'}
                  {c.endsAt ? ` · until ${day(c.endsAt)}` : ''}
                </span>
                <span className="coupon__code mono">{c.code}</span>
                {c.used ? <span className="hint">You used this code.</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted" style={{ fontSize: 14 }}>
        Gift cards and store credit are not available yet.
      </p>
    </div>
  );
}
