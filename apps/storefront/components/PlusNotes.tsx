import { type CartLine, type Totals } from '@nixzora/validation';
import Link from 'next/link';
import { getFormat, getT } from '@/lib/i18n';

/** Whether these totals are a Plus member's (p10-15): the API sets the waived shipping then. */
export const isPlusTotals = (totals: Totals) => totals.shippingWaivedCents !== undefined;

/** The shipping amount in a summary: "FREE with Plus" for members. */
export async function ShippingAmount({ totals }: { totals: Totals }) {
  const [o, pl, f] = await Promise.all([getT('order'), getT('plus'), getFormat()]);
  if (isPlusTotals(totals)) return <span className="plus-free">{pl('freeWithPlus')}</span>;
  return <>{totals.shippingCents ? f.money(totals.shippingCents) : o('free')}</>;
}

/** Under a summary: the member's 2-day promise, or what Plus would save a shopper on shipping. */
export async function PlusShippingNote({
  totals,
  signedIn,
}: {
  totals: Totals;
  signedIn: boolean;
}) {
  const [pl, f] = await Promise.all([getT('plus'), getFormat()]);
  if (isPlusTotals(totals)) {
    return (
      <p className="plus-note">
        <span className="plus-chip">{pl('badge')}</span>{' '}
        {totals.shippingSpeed === 'TWO_DAY'
          ? pl('twoDayWithPlus')
          : totals.shippingWaivedCents
            ? pl('shippingWaived', { amount: f.money(totals.shippingWaivedCents) })
            : pl('freeWithPlus')}
      </p>
    );
  }
  if (!totals.shippingCents) return null;
  return (
    <p className="plus-note plus-note--upsell">
      <span className="plus-chip">{pl('badge')}</span>{' '}
      {pl('upsellShipping', { amount: f.money(totals.shippingCents) })}{' '}
      <Link href={signedIn ? '/plus' : '/account/login?next=%2Fplus'}>{pl('upsellCta')}</Link>
    </p>
  );
}

/** On a cart line priced for a member: the "Plus price" tag and the everyone price. */
export async function PlusLineTag({ line }: { line: CartLine }) {
  if (!line.regularPriceCents) return null;
  const [pl, f] = await Promise.all([getT('plus'), getFormat()]);
  return (
    <div className="plus-line">
      <span className="plus-chip">{pl('plusPrice')}</span>{' '}
      <s className="muted">{f.money(line.regularPriceCents * line.quantity)}</s>
    </div>
  );
}
