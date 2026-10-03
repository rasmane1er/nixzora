import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The terms for shopping at NIXZORA.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="October 2, 2026">
      <p>
        These terms apply when you use the NIXZORA website or app. By shopping with us you agree to
        them. Our <Link href="/privacy">privacy policy</Link> explains how we handle your data.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your sign-in details safe and tell us if you think someone else is using your account.
        You can sign in with an email and password, or with Google or Apple. You can close your
        account at any time.
      </p>

      <h2>Orders and prices</h2>
      <p>
        Prices are shown in US dollars and include any discount shown at checkout; sales tax and
        shipping are added before you pay. An order is accepted when we send the confirmation email.
        If an item turns out to be unavailable or mispriced, we will tell you and refund anything
        you paid for it.
      </p>

      <h2>Shipping</h2>
      <p>
        Shipping is free on orders over $99 and $9.99 below that, unless checkout shows otherwise.
        Delivery dates are estimates.
      </p>

      <h2>Returns and refunds</h2>
      <p>
        You can return most items within 30 days of delivery in their original condition. Start a
        return from your order page. Refunds go back to the original payment method once we receive
        the item.
      </p>

      <h2>Product information and the assistant</h2>
      <p>
        We try to keep specifications, stock and prices accurate. The shopping assistant suggests
        products from our catalog; check the product page before you buy, as the product page and
        checkout are what count.
      </p>

      <h2>Reviews and content</h2>
      <p>
        Reviews must be honest and about the product. We may remove content that is unlawful,
        abusive, misleading or off-topic.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not misuse the store: no scraping at scale, interfering with the service, reselling
        accounts or buying on someone else&apos;s payment method without permission.
      </p>

      <h2>Liability</h2>
      <p>
        Products come with the manufacturer&apos;s warranty and any rights you have under the law,
        which these terms do not limit. Otherwise, to the extent the law allows, our liability for
        an order is limited to the amount you paid for it.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will post changes here. Questions:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
