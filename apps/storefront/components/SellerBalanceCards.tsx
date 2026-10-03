import { type SellerBalance } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';

/** The four seller balance figures: available, on hold, waiting to ship, lifetime. */
export function SellerBalanceCards({ balance }: { balance: SellerBalance }) {
  const money = (cents: number) => formatMoney(cents, balance.currency);
  return (
    <div className="seller-stats">
      {(
        [
          ['Available', money(balance.availableCents), 'Ready for the next payout'],
          ['On hold', money(balance.onHoldCents), 'Shipped, inside the hold period'],
          ['Waiting to ship', money(balance.pendingCents), 'Paid orders you have not shipped'],
          ['Lifetime', money(balance.lifetimeNetCents), 'Earned after commission and refunds'],
        ] as const
      ).map(([label, value, hint]) => (
        <div key={label} className="card">
          <span className="muted">{label}</span>
          <strong>{value}</strong>
          <span className="muted" style={{ fontSize: 13 }}>
            {hint}
          </span>
        </div>
      ))}
    </div>
  );
}
