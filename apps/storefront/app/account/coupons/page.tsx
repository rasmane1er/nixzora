import { type AccountCoupon } from '@nixzora/validation';
import type { Metadata } from 'next';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('account');
  return { title: t('coupons'), robots: { index: false } };
}

export default async function CouponsPage() {
  const coupons = await accountApi<AccountCoupon[]>('/me/coupons', '/account/coupons');
  const [t, f] = await Promise.all([getT('account'), getFormat()]);
  const amount = (c: AccountCoupon): string =>
    t('amountOff', {
      amount: c.type === 'PERCENT' ? f.percent(c.value / 10000) : f.money(c.value, 'USD'),
    });
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader title={t('coupons')} description={t('couponsDescription')} />
      {coupons.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>{t('noCoupons')}</p>
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
                    ? t('minOrder', { amount: f.money(c.minSubtotalCents, 'USD') })
                    : t('noMinimum')}
                  {c.endsAt ? ` · ${t('until', { date: f.date(c.endsAt) })}` : ''}
                </span>
                <span className="coupon__code mono">{c.code}</span>
                {c.used ? <span className="hint">{t('usedCode')}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted" style={{ fontSize: 14 }}>
        {t('giftCards')}
      </p>
    </div>
  );
}
