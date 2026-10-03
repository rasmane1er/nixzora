import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';

export const metadata: Metadata = { title: 'Payment methods', robots: { index: false } };

/**
 * NIXZORA does not keep cards: they are entered on the payment provider's secure form at
 * checkout. This page says so plainly and lists the ways to pay.
 */
export default async function PaymentsPage() {
  await accountApi('/me/profile', '/account/payments');
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 820 }}>
      <AccountHeader
        title="Payment methods"
        description="How you can pay, and how we keep your card details safe."
      />
      <section className="card stack">
        <h2>Ways to pay</h2>
        <ul className="pay-list">
          <li>
            <strong>Credit and debit cards</strong>
            <span className="muted">Visa, Mastercard, American Express and Discover.</span>
          </li>
          <li>
            <strong>Apple Pay and Google Pay</strong>
            <span className="muted">Offered at checkout on devices that support them.</span>
          </li>
        </ul>
      </section>
      <section className="card stack">
        <h2>No saved cards, on purpose</h2>
        <p style={{ margin: 0 }}>
          You enter your card on our payment provider&apos;s secure form at checkout, each time.
          Card numbers never reach NIXZORA&apos;s servers and are not stored in your account, so
          there is nothing here to steal or to remove.
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Refunds always go back to the card you paid with. See{' '}
          <Link href="/account/returns">Returns &amp; refunds</Link>.
        </p>
      </section>
    </div>
  );
}
