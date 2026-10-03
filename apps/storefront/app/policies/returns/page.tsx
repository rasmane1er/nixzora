import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Return policy',
  description: 'Returns and refunds at NIXZORA.',
};

export default function ReturnPolicyPage() {
  return (
    <LegalPage title="Return policy" updated="October 3, 2026">
      <h2>30 days</h2>
      <p>
        You can return most items within 30 days of delivery, in their original condition and with
        their accessories. This includes items from marketplace sellers.
      </p>
      <h2>How to return</h2>
      <p>
        Open the order in <Link href="/account/orders">Your orders</Link>, choose “Return or replace
        items”, pick the items and a reason. We approve it and tell you how to send it back. Follow
        the steps in <Link href="/account/returns">Returns &amp; refunds</Link>.
      </p>
      <h2>Refunds</h2>
      <p>
        When the item arrives back with us, we refund what you paid for it to the card you used,
        including its share of tax, less its share of any coupon discount. Banks usually show the
        refund within 5–10 business days.
      </p>
      <h2>Damaged or wrong items</h2>
      <p>
        Choose “Arrived damaged” or “Wrong item sent” as the reason. Questions?{' '}
        <Link href="/help/contact?topic=RETURN">Contact us</Link>.
      </p>
    </LegalPage>
  );
}
