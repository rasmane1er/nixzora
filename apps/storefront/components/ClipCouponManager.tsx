import { type ClipCouponView } from '@nixzora/validation';
import Link from 'next/link';
import { couponLabel } from '@/lib/coupons';
import { getFormat, getT } from '@/lib/i18n';
import { TimezoneOffset } from './TimezoneOffset';

/** Clip coupons (p10-18): the "New coupon" form for the seller portal. */
export async function ClipCouponForm({
  products,
  action,
}: {
  products: { id: string; title: string }[];
  action: (form: FormData) => Promise<void>;
}) {
  const t = await getT('clips');
  if (!products.length) return <p className="banner banner--info">{t('noProducts')}</p>;
  return (
    <form action={action} className="card form deal-form">
      <h3>{t('newCoupon')}</h3>
      <TimezoneOffset />
      <div className="form-row">
        <label>
          {t('product')}
          <select name="productId" required defaultValue="">
            <option value="" disabled>
              {t('chooseProduct')}
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('kind')}
          <select name="kind" defaultValue="PERCENT">
            <option value="PERCENT">{t('kind_PERCENT')}</option>
            <option value="AMOUNT">{t('kind_AMOUNT')}</option>
          </select>
        </label>
        <label>
          {t('percent')} / {t('amount')}
          <input name="value" type="number" min={1} step="0.01" required defaultValue={10} />
        </label>
      </div>
      <div className="form-row">
        <label>
          {t('starts')}
          <input name="startsAt" type="datetime-local" />
        </label>
        <label>
          {t('ends')}
          <input name="endsAt" type="datetime-local" required />
        </label>
        <label>
          {t('budget')}
          <input name="maxRedemptions" type="number" min={1} />
          <span className="hint">{t('budgetHint')}</span>
        </label>
      </div>
      <button className="btn btn--primary" type="submit">
        {t('create')}
      </button>
    </form>
  );
}

/** Coupons as a table (seller portal), with "End" while live. */
export async function ClipCouponTable({
  coupons,
  end,
}: {
  coupons: ClipCouponView[];
  end: (form: FormData) => Promise<void>;
}) {
  const [t, f] = await Promise.all([getT('clips'), getFormat()]);
  if (!coupons.length) return <p className="muted">{t('noCoupons')}</p>;
  return (
    <div className="card table-scroll">
      <table className="plain">
        <thead>
          <tr>
            <th>{t('colProduct')}</th>
            <th>{t('colCoupon')}</th>
            <th>{t('colWhen')}</th>
            <th>{t('colClips')}</th>
            <th>{t('colUsed')}</th>
            <th>{t('colStatus')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/p/${c.product.slug}`}>{c.product.title}</Link>
              </td>
              <td>{couponLabel(c, t, f)}</td>
              <td>{t('when', { start: f.dateTime(c.startsAt), end: f.dateTime(c.endsAt) })}</td>
              <td>{f.number(c.clips)}</td>
              <td>
                {c.maxRedemptions != null
                  ? t('usedOf', { used: f.number(c.redeemed), max: f.number(c.maxRedemptions) })
                  : f.number(c.redeemed)}
              </td>
              <td>{t(`status_${c.status}`)}</td>
              <td>
                {c.status === 'ACTIVE' ? (
                  <form action={end}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn btn--secondary btn--sm" type="submit">
                      {t('end')}
                    </button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
