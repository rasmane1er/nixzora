import {
  type MeResponse,
  type PagedResult,
  type SellerBalance,
  type SellerOrderView,
  type SellerView,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SellerBalanceCards } from '@/components/SellerBalanceCards';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';
import { sellerMe } from '@/lib/sell';
import { applyToSell } from './actions';

export const metadata: Metadata = {
  title: 'Sell on NIXZORA',
  description: 'List your electronics on NIXZORA: reach shoppers who know what they want.',
};

export default async function SellPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const notice = param(params, 'notice');
  const error = param(params, 'error');

  if (!(await isSignedIn())) return <Pitch />;
  const { seller } = await sellerMe('/sell');
  if (!seller) {
    const me = await api<MeResponse>('/auth/me');
    return <Apply email={me.email} notice={notice} error={error} />;
  }
  const [balance, toShip] = await Promise.all([
    api<SellerBalance>('/seller/balance'),
    api<PagedResult<SellerOrderView>>('/seller/orders?status=PAID&pageSize=1'),
  ]);
  return (
    <Overview
      seller={seller}
      balance={balance}
      toShip={toShip.total}
      notice={notice}
      error={error}
    />
  );
}

const STEPS = [
  ['Apply', 'Tell us about your business. It takes two minutes.'],
  ['Verify', 'Stripe confirms your identity and bank account. NIXZORA never sees them.'],
  ['List', 'Add products with photos and specs. We review each listing before it goes live.'],
  ['Get paid', 'You keep 88% of each sale, paid out to your bank after delivery.'],
] as const;

function Pitch() {
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <section className="hero">
        <p className="eyebrow" style={{ color: 'inherit', opacity: 0.8 }}>
          Sell on NIXZORA
        </p>
        <h1>Reach shoppers who compare before they buy.</h1>
        <p style={{ maxWidth: 560 }}>
          Our assistant matches shoppers to products by their specs, so well-described listings get
          found. List computers, audio and accessories alongside the NIXZORA catalog.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn--primary" href="/account/register?next=/sell">
            Create an account to start
          </Link>
          <Link className="btn btn--secondary" href="/account/login?next=/sell">
            Sign in
          </Link>
        </div>
      </section>
      <Steps />
    </div>
  );
}

function Steps() {
  return (
    <ol className="seller-steps">
      {STEPS.map(([title, body], index) => (
        <li key={title} className="card">
          <span className="seller-steps__n">{index + 1}</span>
          <strong>{title}</strong>
          <span className="muted">{body}</span>
        </li>
      ))}
    </ol>
  );
}

function Apply({ email, notice, error }: { email: string; notice?: string; error?: string }) {
  return (
    <div className="wrap section stack" style={{ gap: 24, maxWidth: 760 }}>
      <div className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">Sell on NIXZORA</p>
        <h1>Open your store</h1>
        <p className="muted">
          Applications are reviewed by our team, usually within one business day. You can prepare
          listings while you wait.
        </p>
      </div>
      <Notices notice={notice} error={error} />
      <form action={applyToSell} className="card form">
        <div className="form-row">
          <label>
            Store name
            <input name="displayName" required minLength={2} maxLength={60} />
          </label>
          <label>
            Store address <span className="hint">Optional. Letters, numbers and hyphens.</span>
            <input
              name="handle"
              placeholder="brightline-audio"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              minLength={3}
              maxLength={40}
            />
          </label>
        </div>
        <label>
          Legal business name{' '}
          <span className="hint">As registered, e.g. “Brightline Audio LLC”.</span>
          <input name="legalName" required minLength={2} maxLength={120} />
        </label>
        <label>
          Contact email <span className="hint">For orders and payouts.</span>
          <input name="contactEmail" type="email" placeholder={email} />
        </label>
        <label>
          About your store <span className="hint">Optional. Shown on your store page.</span>
          <textarea name="description" rows={3} maxLength={1000} />
        </label>
        <p className="muted" style={{ fontSize: 14 }}>
          NIXZORA supports US businesses for now. Payouts go through Stripe Connect.
        </p>
        <label className="check">
          <input type="checkbox" name="acceptTerms" required />
          <span>
            I agree to the <Link href="/terms">seller terms</Link>: accurate listings, shipping
            within 2 business days, a 12% commission on each sale, and NIXZORA&apos;s 30-day return
            policy.
          </span>
        </label>
        <div>
          <button className="btn btn--primary" type="submit">
            Apply to sell
          </button>
        </div>
      </form>
    </div>
  );
}

function Overview({
  seller,
  balance,
  toShip,
  notice,
  error,
}: {
  seller: SellerView;
  balance: SellerBalance;
  toShip: number;
  notice?: string;
  error?: string;
}) {
  const verified = seller.payouts.detailsSubmitted;
  const checklist = [
    { done: true, title: 'Application sent', body: 'Thanks for applying.' },
    {
      done: verified,
      title: 'Verify your business for payouts',
      body: verified
        ? seller.payouts.payoutsEnabled
          ? 'Verified. Payouts are switched on.'
          : 'Submitted. Stripe is still checking your details.'
        : 'Stripe confirms your identity and bank account. NIXZORA never sees them.',
      action: verified ? null : (
        <a className="btn btn--primary btn--sm" href="/sell/payouts/start">
          {seller.payouts.accountConnected ? 'Continue verification' : 'Start verification'}
        </a>
      ),
    },
    {
      done: seller.status === 'ACTIVE',
      title: 'Store approved',
      body:
        seller.status === 'ACTIVE'
          ? 'Your store is open.'
          : seller.status === 'PENDING'
            ? 'We review stores once verification is complete.'
            : (seller.statusReason ?? 'Contact seller support.'),
    },
    {
      done: seller.listings.active > 0,
      title: 'First listing live',
      body: seller.listings.active
        ? `${seller.listings.active} live.`
        : 'Add a product, a photo, and submit it for review.',
      action: (
        <Link className="btn btn--secondary btn--sm" href="/sell/listings/new">
          Add a listing
        </Link>
      ),
    },
  ];

  return (
    <div className="wrap section stack" style={{ gap: 24 }}>
      <SellerNav seller={seller} current="/sell" />
      <Notices notice={notice} error={error} />
      {seller.status === 'SUSPENDED' || seller.status === 'REJECTED' ? (
        <p className="banner banner--error">
          {seller.status === 'SUSPENDED'
            ? 'Your store is suspended.'
            : 'Your application was not approved.'}{' '}
          {seller.statusReason}
        </p>
      ) : null}

      {toShip ? (
        <p className="banner banner--info">
          {toShip} {toShip === 1 ? 'order is' : 'orders are'} waiting to ship.{' '}
          <Link href="/sell/orders">Ship now →</Link>
        </p>
      ) : null}
      <SellerBalanceCards balance={balance} />
      <p className="muted" style={{ fontSize: 14 }}>
        {seller.listings.active} live · {seller.listings.pendingReview} in review ·{' '}
        {seller.listings.draft} {seller.listings.draft === 1 ? 'draft' : 'drafts'} ·{' '}
        {seller.commissionBps / 100}% commission
      </p>

      <section className="card stack">
        <h2>Getting started</h2>
        <ol className="checklist">
          {checklist.map((step) => (
            <li key={step.title} data-done={step.done}>
              <span className="checklist__mark" aria-hidden="true">
                {step.done ? '✓' : ''}
              </span>
              <div className="stack" style={{ gap: 2 }}>
                <strong>
                  {step.title}
                  <span className="sr-only">{step.done ? ' (done)' : ' (to do)'}</span>
                </strong>
                <span className="muted">{step.body}</span>
              </div>
              {step.action && !step.done ? step.action : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
