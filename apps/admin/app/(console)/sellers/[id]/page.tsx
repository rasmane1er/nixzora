import {
  type AdminSellerView,
  BUSINESS_TYPES,
  type BusinessType,
  SELLER_CARRIER_LABEL,
  SELLER_CATEGORIES,
  type SellerCarrier,
  type SellerCategory,
  type PagedResult,
  type PayoutView,
  type SellerBalance,
  type SellerFeedback,
} from '@nixzora/validation';
import { calendarDay, INTL_LOCALE, rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, PageHeader, StatusPill } from '@/components/ui';
import { ApiError, load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { isUuid } from '@/lib/forms';
import { getFormat, getLocale, getT } from '@/lib/i18n';
import {
  changeSellerStatus,
  payOutSeller,
  refreshSellerPayouts,
  updateSellerTerms,
} from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsOrders');
  return { title: t('metaSeller') };
}

const STOREFRONT = process.env.STOREFRONT_URL ?? 'http://localhost:3000';

async function loadSeller(id: string): Promise<AdminSellerView> {
  if (!isUuid(id)) notFound();
  try {
    return await load<AdminSellerView>(`/admin/sellers/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function SellerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const search = await searchParams;
  const seller = await loadSeller(id);
  const [t, f, locale, balance, payoutHistory, feedback] = await Promise.all([
    getT('opsOrders'),
    getFormat(),
    getLocale(),
    load<SellerBalance>(`/admin/sellers/${id}/balance`),
    load<PagedResult<PayoutView>>(`/admin/sellers/${id}/payouts`),
    load<SellerFeedback>(`/admin/sellers/${id}/feedback`),
  ]);
  const openReturns = feedback.returns.filter(
    (r) => r.status === 'REQUESTED' || r.status === 'APPROVED',
  ).length;
  const { payouts } = seller;
  const { money, dateTime } = f;
  const tRisk = await getT('opsRisk');
  const vac = await getT('vacation');

  return (
    <>
      <PageHeader
        eyebrow={t('metaSeller')}
        title={seller.displayName}
        actions={
          <Link className="btn btn--secondary" href="/sellers">
            {t('allSellers')}
          </Link>
        }
      />
      <Banner notice={param(search, 'notice')} error={param(search, 'error')} />

      <ApplicationDetails seller={seller} />

      <div className="two-col">
        <section className="card">
          <h2>
            {t('store')} <StatusPill value={seller.status} />
          </h2>
          {seller.statusReason ? (
            <p className="banner banner--error">{seller.statusReason}</p>
          ) : null}
          {seller.away ? (
            // Vacation mode (p10-32): new orders paused by the store.
            <p className="banner">
              {seller.away.until
                ? vac('opsAway', { date: calendarDay(seller.away.until, locale) })
                : vac('opsAwayOpen')}
              {seller.away.message ? ` · “${seller.away.message}”` : ''}
            </p>
          ) : null}
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th scope="row">{t('legalName')}</th>
                  <td>{seller.legalName}</td>
                </tr>
                <tr>
                  <th scope="row">{t('storePage')}</th>
                  <td>
                    {seller.status === 'ACTIVE' ? (
                      <a
                        href={`${STOREFRONT}/s/${seller.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        /s/{seller.handle}
                      </a>
                    ) : (
                      `/s/${seller.handle}`
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row">{t('contact')}</th>
                  <td>{seller.contactEmail}</td>
                </tr>
                <tr>
                  <th scope="row">{t('ownerAccount')}</th>
                  <td>
                    {seller.owner ? (
                      <Link href={`/users/${seller.owner.id}`}>{seller.owner.email}</Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row">{t('country')}</th>
                  <td>{seller.country}</td>
                </tr>
                <tr>
                  <th scope="row">{t('applied')}</th>
                  <td>{dateTime(seller.createdAt)}</td>
                </tr>
                <tr>
                  <th scope="row">{t('approved')}</th>
                  <td>{seller.approvedAt ? dateTime(seller.approvedAt) : '—'}</td>
                </tr>
                <tr>
                  <th scope="row">{t('listings')}</th>
                  <td>
                    {t('listingCounts', {
                      live: seller.listings.active,
                      review: seller.listings.pendingReview,
                      draft: seller.listings.draft,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {seller.description ? <p className="muted">{seller.description}</p> : null}
        </section>

        <section className="card">
          <h2>{t('payoutVerification')}</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th scope="row">{t('provider')}</th>
                  <td>
                    {payouts.provider === 'FAKE'
                      ? t('providerFake')
                      : payouts.provider === 'STRIPE'
                        ? t('providerStripe')
                        : t('payoutsNotStarted')}
                  </td>
                </tr>
                <tr>
                  <th scope="row">{t('detailsSubmitted')}</th>
                  <td>{payouts.detailsSubmitted ? t('yes') : t('no')}</td>
                </tr>
                <tr>
                  <th scope="row">{t('payoutsEnabled')}</th>
                  <td>{payouts.payoutsEnabled ? t('yes') : t('no')}</td>
                </tr>
                {payouts.requirementsDue.length ? (
                  <tr>
                    <th scope="row">{t('stillNeeded')}</th>
                    <td className="mono">{payouts.requirementsDue.join(', ')}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <h3>{t('earnings')}</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th scope="row">{t('available')}</th>
                  <td>{money(balance.availableCents)}</td>
                </tr>
                <tr>
                  <th scope="row">{t('onHold')}</th>
                  <td>{money(balance.onHoldCents)}</td>
                </tr>
                {balance.awaitingScanCents ? (
                  <tr>
                    <th scope="row">{t('awaitingScan')}</th>
                    <td>{money(balance.awaitingScanCents)}</td>
                  </tr>
                ) : null}
                <tr>
                  <th scope="row">{t('waitingToShip')}</th>
                  <td>{money(balance.pendingCents)}</td>
                </tr>
                <tr>
                  <th scope="row">{t('lifetimeNet')}</th>
                  <td>{money(balance.lifetimeNetCents)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {balance.payoutsPaused ? (
            <p className="banner banner--error" role="alert">
              {tRisk('payoutsHeld')} <Link href="/risk?tab=OPEN">{tRisk('openReview')}</Link>
            </p>
          ) : null}
          {balance.availableCents >= 1000 &&
          seller.status === 'ACTIVE' &&
          payouts.payoutsEnabled ? (
            <ActionButton
              action={payOutSeller}
              label={t('payOutNow', { amount: money(balance.availableCents) })}
              tone="primary"
              fields={{ id }}
            />
          ) : null}
          {payoutHistory.items.length ? (
            <>
              <h3>{t('recentPayouts')}</h3>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {payoutHistory.items.slice(0, 10).map((payout) => (
                      <tr key={payout.id}>
                        <td>{dateTime(payout.paidAt ?? payout.createdAt)}</td>
                        <td>
                          <StatusPill value={payout.status} />
                          {payout.failureReason ? (
                            <div className="muted">{payout.failureReason}</div>
                          ) : null}
                        </td>
                        <td>{payout.automatic ? t('payoutDailyRun') : t('payoutStaff')}</td>
                        <td className="num">{money(payout.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          {payouts.accountConnected ? (
            <ActionButton
              action={refreshSellerPayouts}
              label={t('refreshFromProvider')}
              fields={{ id }}
            />
          ) : null}
        </section>
      </div>

      <div className="two-col">
        <section className="card">
          <h2>{t('decision')}</h2>
          {seller.status === 'PENDING' || seller.status === 'SUSPENDED' ? (
            <>
              <p className="muted">
                {seller.status === 'PENDING' ? t('approveHint') : t('reinstateHint')}
              </p>
              {payouts.detailsSubmitted ? (
                <ActionButton
                  action={changeSellerStatus}
                  label={seller.status === 'PENDING' ? t('approveStore') : t('reinstateStore')}
                  tone="primary"
                  fields={{ id, status: 'ACTIVE' }}
                />
              ) : (
                <p className="banner banner--error">{t('waitingPayoutVerification')}</p>
              )}
            </>
          ) : null}
          {seller.status === 'PENDING' || seller.status === 'ACTIVE' ? (
            <form action={changeSellerStatus} className="form" style={{ marginTop: 16 }}>
              <input type="hidden" name="id" value={id} />
              <input
                type="hidden"
                name="status"
                value={seller.status === 'PENDING' ? 'REJECTED' : 'SUSPENDED'}
              />
              <label>
                {seller.status === 'PENDING' ? t('reasonRejecting') : t('reasonSuspending')}{' '}
                <span className="hint">{t('shownToSeller')}</span>
                <textarea name="reason" rows={2} required minLength={5} maxLength={500} />
              </label>
              <div>
                <SubmitButton tone="danger">
                  {seller.status === 'PENDING' ? t('rejectApplication') : t('suspendStore')}
                </SubmitButton>
              </div>
              {seller.status === 'ACTIVE' ? <p className="muted">{t('suspendHint')}</p> : null}
            </form>
          ) : null}
          {seller.status === 'REJECTED' ? (
            <p className="muted">{t('applicationRejected')}</p>
          ) : null}
        </section>

        <form action={updateSellerTerms} className="card form">
          <h2>{t('terms')}</h2>
          <input type="hidden" name="id" value={id} />
          <div className="form-row">
            <label>
              {t('commissionPercent')}
              <input
                name="commissionPercent"
                type="number"
                min={0}
                max={50}
                step={0.01}
                defaultValue={seller.commissionBps / 100}
              />
            </label>
            <label>
              {t('payoutHoldDays')}
              <input
                name="payoutHoldDays"
                type="number"
                min={0}
                max={90}
                defaultValue={seller.payoutHoldDays}
              />
            </label>
          </div>
          <div>
            <SubmitButton>{t('saveTerms')}</SubmitButton>
          </div>
        </form>

        <section className="card">
          <h2>{t('customerFeedback')}</h2>
          <p>
            {feedback.rating.average === null
              ? t('noRatings')
              : t('ratingSummary', {
                  average: feedback.rating.average.toLocaleString(INTL_LOCALE[locale], {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }),
                  count: feedback.rating.count,
                })}
            {' · '}
            {rich(t('returnsSummary', { count: feedback.returns.length, open: openReturns }), {
              link: (chunk) => (
                <Link key="returns" href="/returns">
                  {chunk}
                </Link>
              ),
            })}
          </p>
          {feedback.ratings.length ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  {feedback.ratings.slice(0, 10).map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.orderNumber}</td>
                      <td aria-label={t('starsAria', { rating: r.rating })}>
                        {'★'.repeat(r.rating)}
                      </td>
                      <td>{r.comment ?? <span className="muted">{t('noComment')}</span>}</td>
                      <td className="muted">{dateTime(r.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

/** What the seller entered in the application (p8-13); the owner's details are private. */
async function ApplicationDetails({ seller }: { seller: AdminSellerView }) {
  const [t, tApply, tDept, f] = await Promise.all([
    getT('opsOrders'),
    getT('sellApply'),
    getT('departments'),
    getFormat(),
  ]);
  const v = seller.verification;
  const businessType = seller.businessType as BusinessType | null;
  const category = seller.category as SellerCategory | null;
  const carrierLabel = (carrier: string) =>
    carrier === 'OTHER'
      ? tApply('carrier_OTHER')
      : (SELLER_CARRIER_LABEL[carrier as SellerCarrier] ?? carrier);
  const rows: [string, React.ReactNode][] = [
    [
      t('businessType'),
      businessType
        ? BUSINESS_TYPES.includes(businessType)
          ? tApply(`businessType_${businessType}`)
          : businessType
        : null,
    ],
    [
      t('category'),
      category ? (SELLER_CATEGORIES.includes(category) ? tDept(category) : category) : null,
    ],
    [t('whatTheySell'), seller.whatYouSell],
    [
      t('website'),
      seller.website ? (
        <a href={seller.website} target="_blank" rel="noopener noreferrer nofollow">
          {seller.website}
        </a>
      ) : null,
    ],
    [
      t('businessAddress'),
      seller.address
        ? `${seller.address.line1}${seller.address.line2 ? `, ${seller.address.line2}` : ''}, ${seller.address.city}, ${seller.address.region} ${seller.address.postalCode}`
        : null,
    ],
    [t('owner'), v ? `${v.firstName} ${v.lastName}` : null],
    [t('dateOfBirth'), v ? (v.dateOfBirth ?? t('dobUnreadable')) : null],
    [t('ownerPhone'), v?.phone],
    [
      t('supportContact'),
      [seller.supportEmail, seller.supportPhone].filter(Boolean).join(' · ') || null,
    ],
    [
      t('shipping'),
      `${t('shippingWithin', { count: seller.shipping.handlingDays })}${
        seller.shipping.carriers.length
          ? ` · ${seller.shipping.carriers.map(carrierLabel).join(', ')}`
          : ''
      }`,
    ],
    [
      t('agreementsAccepted'),
      seller.agreementsAcceptedAt ? f.dateTime(seller.agreementsAcceptedAt) : null,
    ],
  ];
  const shown = rows.filter(([, value]) => value);
  if (!v && !seller.businessType) return null;
  return (
    <section className="card">
      <h2>{t('application')}</h2>
      <p className="muted">{t('applicationPrivate')}</p>
      {seller.logoUrl || seller.bannerUrl ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {seller.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- seller upload preview
            <img
              src={seller.logoUrl}
              alt={t('storeLogo')}
              width={72}
              height={72}
              style={{ borderRadius: 12, objectFit: 'cover' }}
            />
          ) : null}
          {seller.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- seller upload preview
            <img
              src={seller.bannerUrl}
              alt={t('storeBanner')}
              height={72}
              style={{ borderRadius: 12, objectFit: 'cover', maxWidth: '100%' }}
            />
          ) : null}
        </div>
      ) : null}
      <div className="table-wrap">
        <table>
          <tbody>
            {shown.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
