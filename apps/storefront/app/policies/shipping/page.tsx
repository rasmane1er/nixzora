import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Shipping policy',
  description: 'Where, when and how NIXZORA ships.',
};

export default function ShippingPolicyPage() {
  return (
    <LegalPage title="Shipping policy" updated="October 3, 2026">
      <h2>Where we ship</h2>
      <p>Addresses in the United States.</p>
      <h2>Cost</h2>
      <p>
        Free on orders over $99 (after any coupon); $9.99 below that. The cart shows the exact
        amount, and how much more you need for free shipping, before you pay.
      </p>
      <h2>When it ships</h2>
      <p>
        Most orders ship within 1–2 business days. You get an email with tracking when your parcel
        leaves, and delivery dates from the carrier are estimates.
      </p>
      <h2>Orders from more than one seller</h2>
      <p>
        Items sold by marketplace stores ship from those stores, so one order can arrive in several
        parcels. Each one has its own tracking on the order page.
      </p>
      <h2>Problems with a delivery</h2>
      <p>
        If a parcel is late, damaged or missing,{' '}
        <Link href="/help/contact?topic=DELIVERY">tell us</Link> and we will sort it out with the
        carrier.
      </p>
    </LegalPage>
  );
}
