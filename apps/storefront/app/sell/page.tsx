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
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';
import { sellerMe } from '@/lib/sell';
import { percentDone } from '@/lib/seller-onboarding';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sell');
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function SellPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const notice = param(params, 'notice');
  const error = param(params, 'error');
  const t = await getT('sell');

  if (!(await isSignedIn())) return <Pitch />;
  const { seller } = await sellerMe('/sell');
  if (!seller) {
    const draft = await api<{ draft: SellerApplicationDraftView | null }>(
      '/seller/application',
    ).then((r) => r.draft);
    return (
      <Pitch draft={draft} signedIn notice={param(params, 'saved') ? t('savedNotice') : notice} />
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
      notice={param(params, 'applied') ? t('appliedNotice') : notice}
      error={error}
    />
  );
}

const STEPS = [
  ['stepApply', 'stepApplyBody'],
  ['stepVerify', 'stepVerifyBody'],
  ['stepList', 'stepListBody'],
  ['stepPaid', 'stepPaidBody'],
] as const;

async function Pitch({
  draft = null,
  signedIn = false,
  notice,
}: {
  draft?: SellerApplicationDraftView | null;
  signedIn?: boolean;
  notice?: string;
}) {
  const percent = percentDone(draft);
  const t = await getT('sell');
  const tc = await getT('common');
  return (
    <div className="wrap section stack" style={{ gap: 28 }}>
      <Notices notice={notice} />
      <section className="hero" aria-labelledby="sell-hero-title">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative, sized by CSS */}
        <img
          className="hero__art"
          src="/home/hero-desk.webp"
          alt={t('heroImageAlt')}
          width={1600}
          height={900}
          fetchPriority="high"
        />
        <div className="hero__content">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 id="sell-hero-title">{t('heroTitle')}</h1>
          <p>{t('heroLead')}</p>
          <div className="hero__actions">
            {signedIn ? (
              <Link className="btn btn--primary" href="/sell/apply">
                {draft ? t('continueApplication', { percent }) : t('startApplication')}
              </Link>
            ) : (
              <>
                <Link className="btn btn--primary" href="/account/register?next=/sell/apply">
                  {t('createAccountToStart')}
                </Link>
                <Link className="btn btn--on-dark" href="/account/login?next=/sell/apply">
                  {tc('signIn')}
                </Link>
              </>
            )}
            <span className="hero__note">{t('heroTime')}</span>
          </div>
        </div>
        <div className="hero__badge">
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
            <path
              d="M3 7.5h18v10.5H3V7.5Zm0 3.75h18M6.75 15h3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            <strong>{t('heroBadgeTitle')}</strong>
            {t('heroBadgeBody')}
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

async function Steps() {
  const t = await getT('sell');
  return (
    <ol className="seller-steps">
      {STEPS.map(([title, body], index) => (
        <li key={title} className="card">
          <span className="seller-steps__n">{index + 1}</span>
          <strong>{t(title)}</strong>
          <span className="muted">{t(body)}</span>
        </li>
      ))}
    </ol>
  );
}

async function Overview({
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
  const t = await getT('sell');
  const f = await getFormat();
  const identity = seller.payouts.detailsSubmitted;
  const payouts = seller.payouts.payoutsEnabled;
  const approved = seller.status === 'ACTIVE';
  const stripeAction = (
    <a className="btn btn--primary btn--sm" href="/sell/payouts/start">
      {seller.payouts.accountConnected ? t('continueWithStripe') : t('connectStripe')}
    </a>
  );
  const application = [
    { done: true, title: t('checkBusiness'), body: `${seller.legalName}` },
    {
      done: true,
      title: t('checkStore'),
      body: `${seller.displayName} · /s/${seller.handle}`,
    },
    {
      done: identity,
      title: t('checkIdentity'),
      body: identity ? t('identityDone') : t('identityTodo'),
      action: identity ? null : stripeAction,
    },
    {
      done: payouts,
      title: t('checkPayment'),
      body: payouts ? t('paymentDone') : identity ? t('paymentChecking') : t('paymentTodo'),
      action: payouts || !identity ? null : stripeAction,
    },
    {
      done: approved,
      title: t('checkFinal'),
      body: approved
        ? t('finalDone')
        : seller.status === 'PENDING'
          ? t('finalPending')
          : (seller.statusReason ?? t('contactSupport')),
    },
  ];
  const statusLabel = approved
    ? t('statusApproved')
    : seller.status === 'PENDING'
      ? identity
        ? t('statusUnderReview')
        : t('statusWaiting')
      : seller.status === 'SUSPENDED'
        ? t('statusSuspended')
        : t('statusNotApproved');
  const checklist = [
    ...application,
    {
      done: seller.listings.active > 0,
      title: t('checkFirstListing'),
      body: seller.listings.active
        ? t('listingsLive', { count: seller.listings.active })
        : t('firstListingTodo'),
      action: (
        <Link className="btn btn--secondary btn--sm" href="/sell/listings/new">
          {t('addListing')}
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
          {seller.status === 'SUSPENDED' ? t('storeSuspended') : t('applicationNotApproved')}{' '}
          {seller.statusReason}
        </p>
      ) : null}

      {toShip ? (
        <p className="banner banner--info">
          {t('toShip', { count: toShip })} <Link href="/sell/orders">{t('shipNow')}</Link>
        </p>
      ) : null}
      <SellerBalanceCards balance={balance} />
      <p className="muted" style={{ fontSize: 14 }}>
        {t('listingSummary', {
          live: seller.listings.active,
          review: seller.listings.pendingReview,
          drafts: seller.listings.draft,
          rate: f.percent(seller.commissionBps / 10_000),
        })}
      </p>

      {showApplication ? (
        <section className="card stack application-status">
          <header className="application-status__head">
            <h2>{approved ? t('gettingStarted') : t('sellerApplication')}</h2>
            <span
              className={`status-badge status-badge--${approved ? 'ok' : seller.status === 'PENDING' ? 'wait' : 'error'}`}
            >
              {statusLabel}
            </span>
          </header>
          {!approved && seller.status === 'PENDING' ? (
            <p className="muted" style={{ margin: 0 }}>
              {t('weWillEmail', { email: seller.contactEmail })}
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
                    <span className="sr-only">{` ${step.done ? t('srDone') : t('srTodo')}`}</span>
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
