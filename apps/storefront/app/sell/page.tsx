import {
  type PagedResult,
  type SellerApplicationDraftView,
  type SellerBalance,
  type SellerOrderView,
  type SellerView,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SellerBalanceCards } from '@/components/SellerBalanceCards';
import { FeeSummary, SellerFaq, WhySell } from '@/components/SellerLanding';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';
import { sellerMe } from '@/lib/sell';
import { percentDone } from '@/lib/seller-onboarding';

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
    const draft = await api<{ draft: SellerApplicationDraftView | null }>(
      '/seller/application',
    ).then((r) => r.draft);
    return (
      <Pitch
        draft={draft}
        signedIn
        notice={param(params, 'saved') ? 'Saved. Continue your application any time.' : notice}
      />
    );
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
      notice={
        param(params, 'applied')
          ? 'Application submitted. Next, connect Stripe so we can verify your business.'
          : notice
      }
      error={error}
    />
  );
}

const STEPS = [
  ['Apply', 'Six short steps: your business, you, your store, shipping, fees and review.'],
  ['Verify', 'Stripe confirms your identity and bank account. NIXZORA never sees them.'],
  ['List', 'Add products with photos and specs. We review each listing before it goes live.'],
  ['Get paid', 'You keep 88% of the item price, plus shipping, paid out to your bank.'],
] as const;

function Pitch({
  draft = null,
  signedIn = false,
  notice,
}: {
  draft?: SellerApplicationDraftView | null;
  signedIn?: boolean;
  notice?: string;
}) {
  const percent = percentDone(draft);
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <Notices notice={notice} />
      <section className="hero">
        <p className="eyebrow" style={{ color: 'inherit', opacity: 0.8 }}>
          Sell on NIXZORA
        </p>
        <h1>Open your store on NIXZORA.</h1>
        <p style={{ maxWidth: 560 }}>
          Reach shoppers who compare before they buy. List computers, audio and accessories
          alongside the NIXZORA catalog; our team reviews every store and listing.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {signedIn ? (
            <Link className="btn btn--primary" href="/sell/apply">
              {draft
                ? `Continue your application (${percent}% complete)`
                : 'Start your application'}
            </Link>
          ) : (
            <>
              <Link className="btn btn--primary" href="/account/register?next=/sell/apply">
                Create an account to start
              </Link>
              <Link className="btn btn--secondary" href="/account/login?next=/sell/apply">
                Sign in
              </Link>
            </>
          )}
          <span style={{ opacity: 0.85, fontSize: 14 }}>
            About 10 minutes. Save and finish later.
          </span>
        </div>
      </section>
      <Steps />
      <WhySell />
      <FeeSummary />
      <SellerFaq />
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
  const identity = seller.payouts.detailsSubmitted;
  const payouts = seller.payouts.payoutsEnabled;
  const approved = seller.status === 'ACTIVE';
  const stripeAction = (
    <a className="btn btn--primary btn--sm" href="/sell/payouts/start">
      {seller.payouts.accountConnected ? 'Continue with Stripe' : 'Connect Stripe'}
    </a>
  );
  const application = [
    { done: true, title: 'Business information', body: `${seller.legalName}` },
    { done: true, title: 'Store information', body: `${seller.displayName} · /s/${seller.handle}` },
    {
      done: identity,
      title: 'Identity verification',
      body: identity
        ? 'Submitted to Stripe.'
        : 'Stripe confirms who you are. NIXZORA never sees your ID.',
      action: identity ? null : stripeAction,
    },
    {
      done: payouts,
      title: 'Payment verification',
      body: payouts
        ? 'Bank account verified. Payouts are switched on.'
        : identity
          ? 'Stripe is checking your bank details.'
          : 'Add your bank account on Stripe to receive payouts.',
      action: payouts || !identity ? null : stripeAction,
    },
    {
      done: approved,
      title: 'Final review',
      body: approved
        ? 'Approved. Your store is open.'
        : seller.status === 'PENDING'
          ? 'Our team reviews your store once Stripe verification is complete, usually within one business day.'
          : (seller.statusReason ?? 'Contact seller support.'),
    },
  ];
  const statusLabel = approved
    ? 'Approved'
    : seller.status === 'PENDING'
      ? identity
        ? 'Under review'
        : 'Waiting for verification'
      : seller.status === 'SUSPENDED'
        ? 'Suspended'
        : 'Not approved';
  const checklist = [
    ...application,
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
  const showApplication = !approved || !payouts || seller.listings.active === 0;

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

      {showApplication ? (
        <section className="card stack application-status">
          <header className="application-status__head">
            <h2>{approved ? 'Getting started' : 'Seller application'}</h2>
            <span
              className={`status-badge status-badge--${approved ? 'ok' : seller.status === 'PENDING' ? 'wait' : 'error'}`}
            >
              {statusLabel}
            </span>
          </header>
          {!approved && seller.status === 'PENDING' ? (
            <p className="muted" style={{ margin: 0 }}>
              We&apos;ll email {seller.contactEmail} when your application has been reviewed. You
              can prepare listings meanwhile.
            </p>
          ) : null}
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
      ) : null}
    </div>
  );
}
