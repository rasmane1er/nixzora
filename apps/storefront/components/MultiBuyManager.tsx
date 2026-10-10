import { multiBuyTerms } from '@nixzora/i18n';
import {
  MULTI_BUY_MAX_BUY,
  MULTI_BUY_MAX_GET,
  type MultiBuyView,
  type ProductCard,
} from '@nixzora/validation';
import Link from 'next/link';
import { getFormat, getT } from '@/lib/i18n';

const PERCENTS = [100, 50, 25] as const;
const DAYS = [7, 14, 30, 90] as const;

/** Buy X, get Y (p10-27): the "new offer" form, on a store's own live listings. */
export async function MultiBuyForm({
  products,
  offers,
  action,
}: {
  products: ProductCard[];
  /** The store's offers: a product in a live one can't join another. */
  offers: MultiBuyView[];
  action: (form: FormData) => Promise<void>;
}) {
  const [t, f] = await Promise.all([getT('multiBuy'), getFormat()]);
  const live = new Map(
    offers
      .filter((o) => o.status === 'ACTIVE')
      .flatMap((o) => o.products.map((p) => [p.id, o] as const)),
  );
  const taken = products.filter((p) => live.has(p.id));
  const free = products.filter((p) => !live.has(p.id));
  if (!products.length) return null;
  if (!free.length) return <p className="banner banner--info">{t('allTaken')}</p>;
  return (
    <form action={action} className="card stack" style={{ gap: 14 }}>
      <h3 style={{ margin: 0 }}>{t('newOffer')}</h3>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label className="stack" style={{ gap: 4, flex: '1 1 120px' }}>
          {t('buy')}
          <select name="buyQty" defaultValue={2}>
            {Array.from({ length: MULTI_BUY_MAX_BUY }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ gap: 4, flex: '1 1 120px' }}>
          {t('get')}
          <select name="getQty" defaultValue={1}>
            {Array.from({ length: MULTI_BUY_MAX_GET }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ gap: 4, flex: '1 1 140px' }}>
          {t('reward')}
          <select name="percentOff" defaultValue={100}>
            {PERCENTS.map((p) => (
              <option key={p} value={p}>
                {p === 100 ? t('free') : t('percentOption', { percent: p })}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ gap: 4, flex: '1 1 160px' }}>
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
      </div>
      <fieldset className="bundle-pick">
        <legend>
          {t('products')} <span className="hint">{t('productsHint')}</span>
        </legend>
        {free.map((p) => (
          <label key={p.id} className="check">
            <input type="checkbox" name="productIds" value={p.id} />
            <span>
              {p.title} <span className="muted">· {f.money(p.priceFromCents)}</span>
            </span>
          </label>
        ))}
        {taken.map((p) => (
          <label key={p.id} className="check muted">
            <input type="checkbox" disabled />
            <span>
              {p.title} · {multiBuyTerms(t, live.get(p.id)!)}
            </span>
          </label>
        ))}
      </fieldset>
      <button className="btn btn--primary" type="submit" style={{ justifySelf: 'start' }}>
        {t('create')}
      </button>
    </form>
  );
}

/** Offers as a table (seller portal), with "End offer" while live. */
export async function MultiBuyTable({
  offers,
  end,
}: {
  offers: MultiBuyView[];
  end: (form: FormData) => Promise<void>;
}) {
  const [t, f] = await Promise.all([getT('multiBuy'), getFormat()]);
  if (!offers.length) return <p className="muted">{t('none')}</p>;
  return (
    <div className="card table-scroll">
      <table className="plain">
        <thead>
          <tr>
            <th>{t('navTitle')}</th>
            <th>{t('products')}</th>
            <th>{t('runFor')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>{multiBuyTerms(t, o)}</strong>
                <div className="muted">
                  {t(`status_${o.status}`)} · {t('orders', { count: o.orders })}
                </div>
              </td>
              <td>
                {o.products.map((p, i) => (
                  <span key={p.id}>
                    {i ? ', ' : ''}
                    <Link href={`/p/${p.slug}`}>{p.title}</Link>
                  </span>
                ))}
              </td>
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
