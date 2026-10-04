import { type SellerBalance } from '@nixzora/validation';
import { getFormat, getT } from '@/lib/i18n';

/**
 * The four seller balance figures: available, on hold, waiting to ship, lifetime; and a notice
 * when a fraud review has paused payouts.
 */
export async function SellerBalanceCards({ balance }: { balance: SellerBalance }) {
  const [t, f] = await Promise.all([getT('sellerTools'), getFormat()]);
  const money = (cents: number) => f.money(cents, balance.currency);
  return (
    <>
      {balance.payoutsPaused ? (
        <p className="banner banner--error" role="alert">
          {t('payoutsPaused')}
        </p>
      ) : null}
      <div className="seller-stats">
        {(
          [
            ['available', t('balAvailable'), money(balance.availableCents), t('balAvailableHint')],
            ['onHold', t('balOnHold'), money(balance.onHoldCents), t('balOnHoldHint')],
            ['waiting', t('balWaiting'), money(balance.pendingCents), t('balWaitingHint')],
            ['lifetime', t('balLifetime'), money(balance.lifetimeNetCents), t('balLifetimeHint')],
          ] as const
        ).map(([key, label, value, hint]) => (
          <div key={key} className="card">
            <span className="muted">{label}</span>
            <strong>{value}</strong>
            <span className="muted" style={{ fontSize: 13 }}>
              {hint}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
