import { spendTiers } from '@nixzora/i18n';
import { SPEND_MAX_TIERS, type SpendOfferView } from '@nixzora/validation';
import Link from 'next/link';
import { getFormat, getT } from '@/lib/i18n';

const DAYS = [7, 14, 30, 90] as const;
/** A starting point shoppers understand at a glance; the store changes the numbers. */
const SUGGESTED = [
  { spend: '50', save: '5' },
  { spend: '100', save: '15' },
  { spend: '', save: '' },
] as const;

/** Spend more, save more (p10-31): the "new offer" form, unless one is already live. */
export async function SpendOfferForm({
  offers,
  action,
}: {
  offers: SpendOfferView[];
  action: (form: FormData) => Promise<void>;
}) {
  const t = await getT('spendSave');
  if (offers.some((o) => o.status === 'ACTIVE')) {
    return <p className="banner banner--info">{t('oneLive')}</p>;
  }
  return (
    <form action={action} className="card stack" style={{ gap: 14 }}>
      <h3 style={{ margin: 0 }}>{t('newOffer')}</h3>
      <p className="hint" style={{ margin: 0 }}>
        {t('tierHint')}
      </p>
      {SUGGESTED.slice(0, SPEND_MAX_TIERS).map((s, i) => (
        <fieldset key={i} className="row spend-tier" style={{ gap: 12, flexWrap: 'wrap' }}>
          <legend>{t('tierLabel', { n: i + 1 })}</legend>
          <label className="stack" style={{ gap: 4, flex: '1 1 160px' }}>
            {t('spend')}
            <input
              name="minDollars"
              inputMode="decimal"
              defaultValue={s.spend}
              required={i === 0}
              pattern="\d{1,6}(\.\d{1,2})?"
            />
          </label>
          <label className="stack" style={{ gap: 4, flex: '1 1 160px' }}>
            {t('save')}
            <input
              name="offDollars"
              inputMode="decimal"
              defaultValue={s.save}
              required={i === 0}
              pattern="\d{1,6}(\.\d{1,2})?"
            />
          </label>
        </fieldset>
      ))}
      <label className="stack" style={{ gap: 4, maxWidth: 260 }}>
        {t('runFor')}
        <select name="days" defaultValue="">
          <option value="">{t('untilEnded')}</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {t('days', { count: d })}
            </option>
          ))}
        </select>
      </label>
      <button className="btn btn--primary" type="submit" style={{ justifySelf: 'start' }}>
        {t('create')}
      </button>
    </form>
  );
}

/** Offers as a table (seller portal and Ops Center), with "End offer" while live. */
export async function SpendOfferTable({
  offers,
  end,
  showStore = false,
}: {
  offers: SpendOfferView[];
  end: (form: FormData) => Promise<void>;
  showStore?: boolean;
}) {
  const [t, f] = await Promise.all([getT('spendSave'), getFormat()]);
  if (!offers.length) return <p className="muted">{t('none')}</p>;
  return (
    <div className="card table-scroll">
      <table className="plain">
        <thead>
          <tr>
            <th>{t('navTitle')}</th>
            {showStore ? <th>{t('store')}</th> : null}
            <th>{t('runFor')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>{spendTiers(t, o.tiers, (c) => f.money(c))}</strong>
                <div className="muted">
                  {t(`status_${o.status}`)} · {t('orders', { count: o.orders })}
                </div>
              </td>
              {showStore ? (
                <td>
                  {o.seller ? (
                    <Link href={`/s/${o.seller.handle}`}>{o.seller.displayName}</Link>
                  ) : (
                    t('nixzora')
                  )}
                </td>
              ) : null}
              <td>{o.endsAt ? t('endsOn', { date: f.date(o.endsAt) }) : t('noEnd')}</td>
              <td>
                {o.status === 'ACTIVE' ? (
                  <form action={end}>
                    <input type="hidden" name="id" value={o.id} />
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
