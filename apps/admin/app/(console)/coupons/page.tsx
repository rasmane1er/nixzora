import { type CouponView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { money, param, type SearchParams } from '@/lib/format';
import { createCoupon, setCouponActive, setCouponPublic } from './actions';

export const metadata: Metadata = { title: 'Coupons' };

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

export default async function CouponsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const coupons = await load<CouponView[]>('/admin/coupons');

  return (
    <>
      <PageHeader eyebrow="Marketing" title="Coupons" />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="two-col">
        <section className="card">
          {coupons.length === 0 ? (
            <Empty>No coupons yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Rules</th>
                    <th className="num">Used</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="mono">{c.code}</span>
                        {c.description ? <div className="muted">{c.description}</div> : null}
                      </td>
                      <td>
                        {c.type === 'PERCENT' ? `${c.value / 100}% off` : `${money(c.value)} off`}
                      </td>
                      <td className="muted">
                        {c.minSubtotalCents ? `Min ${money(c.minSubtotalCents)}` : 'No minimum'}
                        <br />
                        {day(c.startsAt)} → {day(c.endsAt)}
                      </td>
                      <td className="num">
                        {c.redemptionCount}
                        {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                      </td>
                      <td>
                        <StatusPill value={c.isActive ? 'active' : 'archived'} />
                        {c.isPublic ? <div className="muted">Listed in accounts</div> : null}
                      </td>
                      <td className="num">
                        <ActionButton
                          action={setCouponActive}
                          label={c.isActive ? 'Turn off' : 'Turn on'}
                          fields={{ id: c.id, isActive: String(!c.isActive) }}
                        />{' '}
                        <ActionButton
                          action={setCouponPublic}
                          label={c.isPublic ? 'Hide from accounts' : 'List in accounts'}
                          fields={{ id: c.id, isPublic: String(!c.isPublic) }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2>New coupon</h2>
          <form action={createCoupon} className="form">
            <label>
              Code <span className="hint">Letters, numbers and hyphens</span>
              <input
                name="code"
                required
                pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,31}"
                style={{ textTransform: 'uppercase' }}
                placeholder="WELCOME10"
              />
            </label>
            <label>
              Description <span className="hint">Shown to shoppers</span>
              <input name="description" maxLength={200} placeholder="10% off your first order" />
            </label>
            <div className="form-row">
              <label>
                Type
                <select name="type" defaultValue="PERCENT">
                  <option value="PERCENT">Percent off</option>
                  <option value="FIXED">Amount off</option>
                </select>
              </label>
              <label>
                Percent
                <input name="percent" inputMode="decimal" placeholder="10" />
              </label>
              <label>
                Amount ($)
                <input name="amount" inputMode="decimal" placeholder="15.00" />
              </label>
            </div>
            <div className="form-row">
              <label>
                Minimum spend ($)
                <input name="minSubtotal" inputMode="decimal" placeholder="0" />
              </label>
              <label>
                Max uses
                <input name="maxRedemptions" type="number" min={1} placeholder="Unlimited" />
              </label>
            </div>
            <div className="form-row">
              <label>
                Starts
                <input name="startsAt" type="date" />
              </label>
              <label>
                Ends
                <input name="endsAt" type="date" />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" name="isPublic" /> List in customers&apos; accounts (Coupons
              &amp; promotions)
            </label>
            <div>
              <SubmitButton>Create coupon</SubmitButton>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
