import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Help center',
  description: 'Answers about orders, delivery, returns, payments and your NIXZORA account.',
};

const SECTIONS: { title: string; faqs: [string, React.ReactNode][] }[] = [
  {
    title: 'Orders and delivery',
    faqs: [
      [
        'Where is my order?',
        <>
          Open <Link href="/account/orders?filter=open">Your orders</Link> and choose “Track
          package”. Orders with items from marketplace sellers arrive in more than one parcel, each
          with its own tracking.
        </>,
      ],
      [
        'How long does delivery take?',
        <>
          Most orders ship within 1–2 business days. Delivery dates from the carrier are estimates.
          See the <Link href="/policies/shipping">shipping policy</Link>.
        </>,
      ],
      [
        'Can I change or cancel an order?',
        <>
          Until it ships, <Link href="/help/contact?topic=ORDER">contact us</Link> with the order
          number and we will cancel it and refund you. Once it has shipped, return it instead.
        </>,
      ],
      ['Do you ship outside the United States?', 'Not yet: we deliver to US addresses only.'],
    ],
  },
  {
    title: 'Returns and refunds',
    faqs: [
      [
        'How do I return something?',
        <>
          Within 30 days of delivery, open the order and choose “Return or replace items”. Follow
          its progress in <Link href="/account/returns">Returns &amp; refunds</Link>.
        </>,
      ],
      [
        'When do I get my money back?',
        'When the item arrives back with us, we refund the card you paid with. Banks usually show it within 5–10 business days.',
      ],
      [
        'Items from marketplace sellers',
        'They follow the same 30-day policy and you return them through NIXZORA, like everything else.',
      ],
    ],
  },
  {
    title: 'Payments and prices',
    faqs: [
      [
        'Which payment methods do you take?',
        <>
          Cards, Apple Pay and Google Pay. See <Link href="/account/payments">Payment methods</Link>
          .
        </>,
      ],
      [
        'How do I use a coupon?',
        <>
          Enter the code in your cart. Current offers are in{' '}
          <Link href="/account/coupons">Coupons &amp; promotions</Link>.
        </>,
      ],
      ['Do you charge sales tax?', 'Where the law requires it; the cart shows it before you pay.'],
    ],
  },
  {
    title: 'Your account',
    faqs: [
      [
        'I forgot my password',
        <>
          Use <Link href="/account/forgot-password">Forgot password</Link> on the sign-in page.
        </>,
      ],
      [
        'How do I keep my account safe?',
        <>
          Turn on two-step verification and review your devices in{' '}
          <Link href="/account/security">Password &amp; security</Link>.
        </>,
      ],
      [
        'How do I close my account or get my data?',
        <>
          Both are in <Link href="/account/privacy">Privacy &amp; your data</Link>.
        </>,
      ],
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="wrap section stack" style={{ gap: 24, maxWidth: 900 }}>
      <div className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">Help center</p>
        <h1>How can we help?</h1>
        <p className="muted">
          Quick answers first. Can&apos;t find yours? We reply within one business day.
        </p>
      </div>
      <div className="help-actions">
        <Link className="btn btn--primary" href="/help/contact">
          Contact support
        </Link>
        <Link className="btn btn--secondary" href="/account/orders?filter=open">
          Track a package
        </Link>
        <Link className="btn btn--secondary" href="/help/contact?topic=PROBLEM">
          Report a problem
        </Link>
      </div>
      {SECTIONS.map((section) => (
        <section key={section.title} className="card stack" style={{ gap: 4 }}>
          <h2 style={{ marginBottom: 8 }}>{section.title}</h2>
          {section.faqs.map(([q, a]) => (
            <details key={q} className="faq">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
