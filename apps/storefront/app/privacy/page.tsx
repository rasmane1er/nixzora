import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What NIXZORA collects, why, who it is shared with and how to delete it.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 2, 2026">
      <p>
        NIXZORA sells computers and electronics online and in our mobile app. This page explains
        what we collect, why, who we share it with and the choices you have. We do not sell your
        personal information and we do not show ads.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong>: your email, name and, if you set one, a password (stored
          only as a salted hash). If you sign in with Google or Apple we receive your email address,
          your name (Apple shares it only the first time) and an account identifier from that
          provider. We never receive your Google or Apple password.
        </li>
        <li>
          <strong>Orders</strong>: items, prices, shipping and billing addresses, phone number and
          order history.
        </li>
        <li>
          <strong>Payments</strong>: card details go directly to our payment processor, Stripe. We
          keep only the payment status, card brand and last four digits.
        </li>
        <li>
          <strong>Shopping activity</strong>: your cart, saved products, the products you view,
          reviews you write and messages you send to the shopping assistant. Before you sign in,
          product views are tied to a random id stored in your browser or the app, not to you.
        </li>
        <li>
          <strong>Device and security data</strong>: IP address, browser or device type, sign-in
          history and, in the app, a push-notification token if you allow notifications.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To take, ship and support your orders, including receipts and delivery updates.</li>
        <li>
          To run your account and keep it secure (sign-in, two-step verification, fraud checks).
        </li>
        <li>
          To answer shopping questions and recommend products from our catalog (&quot;similar
          products&quot;, &quot;recommended for you&quot;). &quot;Customers also viewed&quot; only
          shows products several different shoppers looked at, never one person&apos;s browsing.
        </li>
        <li>To meet tax, accounting and legal obligations.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        Only service providers that help us run the store, under contract and for these purposes:
      </p>
      <ul>
        <li>Amazon Web Services (hosting, storage and order emails)</li>
        <li>Stripe (payments)</li>
        <li>Google and Apple (only if you choose to sign in with them)</li>
        <li>Expo, Apple and Google push services (app notifications, if you allow them)</li>
        <li>
          AI providers (Anthropic, Voyage AI) when the shopping assistant uses them: only the text
          of your assistant conversation is sent, never your account, address or order details
        </li>
        <li>Shipping carriers (your name and delivery address)</li>
      </ul>
      <p>We may also disclose information when the law requires it.</p>

      <h2>Cookies</h2>
      <p>
        We use only the cookies the store needs to work: keeping you signed in, remembering your
        cart and protecting sign-in. We do not use advertising or cross-site tracking cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Account data stays while your account is open. Order and payment records are kept for as
        long as tax and accounting law requires (generally seven years), without a sign-in once you
        close your account. Product views are deleted after 180 days. Security logs are kept for up
        to one year.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          See and update your details in <Link href="/account">your account</Link>.
        </li>
        <li>
          Close your account at any time in the app (Account → Delete account) or by emailing us. We
          erase your profile, addresses, saved products and linked Google or Apple sign-in.
        </li>
        <li>
          Ask for a copy of your data, or a correction, by emailing{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We reply within 30 days.
        </li>
        <li>Turn off notifications in your phone settings.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Connections are encrypted (HTTPS), data is encrypted at rest, and staff access is limited
        and logged. No system is perfectly secure; if we learn of a breach that affects you we will
        tell you.
      </p>

      <h2>Children</h2>
      <p>
        NIXZORA is not directed to children under 13, and we do not knowingly collect their data.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We will post changes here and update the date above. Questions:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
