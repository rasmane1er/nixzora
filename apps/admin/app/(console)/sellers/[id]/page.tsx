import {
  type AdminSellerView,
  type PagedResult,
  type PayoutView,
  type SellerBalance,
  type SellerFeedback,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, PageHeader, StatusPill } from '@/components/ui';
import { ApiError, load } from '@/lib/api';
import { dateTime, money, param, type SearchParams } from '@/lib/format';
import {
  changeSellerStatus,
  payOutSeller,
  refreshSellerPayouts,
  updateSellerTerms,
} from '../actions';

export const metadata: Metadata = { title: 'Seller' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STOREFRONT = process.env.STOREFRONT_URL ?? 'http://localhost:3000';

async function loadSeller(id: string): Promise<AdminSellerView> {
  if (!UUID.test(id)) notFound();
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
  const [balance, payoutHistory, feedback] = await Promise.all([
    load<SellerBalance>(`/admin/sellers/${id}/balance`),
    load<PagedResult<PayoutView>>(`/admin/sellers/${id}/payouts`),
    load<SellerFeedback>(`/admin/sellers/${id}/feedback`),
  ]);
  const openReturns = feedback.returns.filter(
    (r) => r.status === 'REQUESTED' || r.status === 'APPROVED',
  ).length;
  const { payouts } = seller;

  return (
    <>
      <PageHeader
        eyebrow="Seller"
        title={seller.displayName}
        actions={
          <Link className="btn btn--secondary" href="/sellers">
            All sellers
          </Link>
        }
      />
      <Banner notice={param(search, 'notice')} error={param(search, 'error')} />

      <div className="two-col">
        <section className="card">
          <h2>
            Store <StatusPill value={seller.status} />
          </h2>
          {seller.statusReason ? (
            <p className="banner banner--error">{seller.statusReason}</p>
          ) : null}
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th scope="row">Legal name</th>
                  <td>{seller.legalName}</td>
                </tr>
                <tr>
                  <th scope="row">Store page</th>
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
                  <th scope="row">Contact</th>
                  <td>{seller.contactEmail}</td>
                </tr>
                <tr>
                  <th scope="row">Owner account</th>
                  <td>
                    {seller.owner ? (
                      <Link href={`/users/${seller.owner.id}`}>{seller.owner.email}</Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Country</th>
                  <td>{seller.country}</td>
                </tr>
                <tr>
                  <th scope="row">Applied</th>
                  <td>{dateTime(seller.createdAt)}</td>
                </tr>
                <tr>
                  <th scope="row">Approved</th>
                  <td>{seller.approvedAt ? dateTime(seller.approvedAt) : '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Listings</th>
                  <td>
                    {seller.listings.active} live · {seller.listings.pendingReview} in review ·{' '}
                    {seller.listings.draft} draft
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {seller.description ? <p className="muted">{seller.description}</p> : null}
        </section>

        <section className="card">
          <h2>Payout verification</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th scope="row">Provider</th>
                  <td>
                    {payouts.provider === 'FAKE'
                      ? 'Test mode (no money moves)'
                      : payouts.provider === 'STRIPE'
                        ? 'Stripe Connect'
                        : 'Not started'}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Details submitted</th>
                  <td>{payouts.detailsSubmitted ? 'Yes' : 'No'}</td>
                </tr>
                <tr>
                  <th scope="row">Payouts enabled</th>
                  <td>{payouts.payoutsEnabled ? 'Yes' : 'No'}</td>
                </tr>
                {payouts.requirementsDue.length ? (
                  <tr>
                    <th scope="row">Still needed</th>
                    <td className="mono">{payouts.requirementsDue.join(', ')}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <h3>Earnings</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th scope="row">Available</th>
                  <td>{money(balance.availableCents)}</td>
                </tr>
                <tr>
                  <th scope="row">On hold</th>
                  <td>{money(balance.onHoldCents)}</td>
                </tr>
                <tr>
                  <th scope="row">Waiting to ship</th>
                  <td>{money(balance.pendingCents)}</td>
                </tr>
                <tr>
                  <th scope="row">Lifetime net</th>
                  <td>{money(balance.lifetimeNetCents)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {balance.availableCents >= 1000 &&
          seller.status === 'ACTIVE' &&
          payouts.payoutsEnabled ? (
            <ActionButton
              action={payOutSeller}
              label={`Pay out ${money(balance.availableCents)} now`}
              tone="primary"
              fields={{ id }}
            />
          ) : null}
          {payoutHistory.items.length ? (
            <>
              <h3>Recent payouts</h3>
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
                        <td>{payout.automatic ? 'Daily run' : 'Staff'}</td>
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
              label="Refresh from provider"
              fields={{ id }}
            />
          ) : null}
        </section>
      </div>

      <div className="two-col">
        <section className="card">
          <h2>Decision</h2>
          {seller.status === 'PENDING' || seller.status === 'SUSPENDED' ? (
            <>
              <p className="muted">
                {seller.status === 'PENDING'
                  ? 'Approve once the business is verified and the application looks legitimate.'
                  : 'Reinstating does not republish listings; the seller resubmits them.'}
              </p>
              {payouts.detailsSubmitted ? (
                <ActionButton
                  action={changeSellerStatus}
                  label={seller.status === 'PENDING' ? 'Approve store' : 'Reinstate store'}
                  tone="primary"
                  fields={{ id, status: 'ACTIVE' }}
                />
              ) : (
                <p className="banner banner--error">
                  Waiting for the seller to finish payout verification.
                </p>
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
                {seller.status === 'PENDING' ? 'Reason for rejecting' : 'Reason for suspending'}{' '}
                <span className="hint">Shown to the seller.</span>
                <textarea name="reason" rows={2} required minLength={5} maxLength={500} />
              </label>
              <div>
                <SubmitButton tone="danger">
                  {seller.status === 'PENDING' ? 'Reject application' : 'Suspend store'}
                </SubmitButton>
              </div>
              {seller.status === 'ACTIVE' ? (
                <p className="muted">Suspending takes every listing off sale immediately.</p>
              ) : null}
            </form>
          ) : null}
          {seller.status === 'REJECTED' ? (
            <p className="muted">This application was rejected.</p>
          ) : null}
        </section>

        <form action={updateSellerTerms} className="card form">
          <h2>Terms</h2>
          <input type="hidden" name="id" value={id} />
          <div className="form-row">
            <label>
              Commission (%)
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
              Payout hold (days)
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
            <SubmitButton>Save terms</SubmitButton>
          </div>
        </form>

        <section className="card">
          <h2>Customer feedback</h2>
          <p>
            {feedback.rating.average === null
              ? 'No ratings yet.'
              : `${feedback.rating.average.toFixed(1)} out of 5 from ${feedback.rating.count} ${feedback.rating.count === 1 ? 'order' : 'orders'}`}
            {' · '}
            {feedback.returns.length} {feedback.returns.length === 1 ? 'return' : 'returns'} of its
            items ({openReturns} open) · <Link href="/returns">Returns queue</Link>
          </p>
          {feedback.ratings.length ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  {feedback.ratings.slice(0, 10).map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.orderNumber}</td>
                      <td aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}</td>
                      <td>{r.comment ?? <span className="muted">No comment</span>}</td>
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
