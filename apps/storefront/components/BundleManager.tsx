import {
  BUNDLE_MAX_PERCENT,
  BUNDLE_MIN_PERCENT,
  type BundleView,
  type ProductCard,
} from '@nixzora/validation';
import Link from 'next/link';
import { getFormat, getT } from '@/lib/i18n';

/** Bundle & save (p10-16): the "new bundle" form, for a store's own single-option listings. */
export async function BundleForm({
  products,
  action,
}: {
  products: ProductCard[];
  action: (form: FormData) => Promise<void>;
}) {
  const [t, f] = await Promise.all([getT('bundles'), getFormat()]);
  const eligible = products.filter((p) => p.defaultVariantId);
  if (eligible.length < 2) return <p className="banner banner--info">{t('noProducts')}</p>;
  return (
    <form action={action} className="card stack" style={{ gap: 14 }}>
      <h3 style={{ margin: 0 }}>{t('newBundle')}</h3>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <label className="stack" style={{ gap: 4, flex: '2 1 240px' }}>
          {t('name')}
          <input
            name="title"
            required
            minLength={3}
            maxLength={80}
            placeholder={t('namePlaceholder')}
          />
        </label>
        <label className="stack" style={{ gap: 4, flex: '1 1 160px' }}>
          {t('percent')}
          <input
            name="percentOff"
            type="number"
            min={BUNDLE_MIN_PERCENT}
            max={BUNDLE_MAX_PERCENT}
            defaultValue={10}
            required
          />
        </label>
      </div>
      <fieldset className="bundle-pick">
        <legend>{t('pickProducts')}</legend>
        {eligible.map((p) => (
          <label key={p.id} className="check">
            <input type="checkbox" name="productIds" value={p.id} />
            <span>
              {p.title} <span className="muted">· {f.money(p.priceFromCents)}</span>
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

/** Bundles as a table (seller portal and Ops), with "Retire" while live. */
export async function BundleTable({
  bundles,
  archive,
  showStore = false,
  productHref = (slug) => `/p/${slug}`,
}: {
  bundles: BundleView[];
  archive: (form: FormData) => Promise<void>;
  showStore?: boolean;
  productHref?: (slug: string) => string;
}) {
  const [t, f] = await Promise.all([getT('bundles'), getFormat()]);
  if (!bundles.length) return <p className="muted">{t('none')}</p>;
  return (
    <div className="card table-scroll">
      <table className="plain">
        <thead>
          <tr>
            <th>{t('colBundle')}</th>
            {showStore ? <th>{t('colStore')}</th> : null}
            <th>{t('colProducts')}</th>
            <th>{t('colPrice')}</th>
            <th>{t('colStatus')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {bundles.map((b) => (
            <tr key={b.id}>
              <td>
                <strong>{b.title}</strong>
                <div className="muted">{f.percent(b.percentOff / 100)}</div>
              </td>
              {showStore ? <td>{b.seller?.displayName ?? t('houseStore')}</td> : null}
              <td>
                {b.products.map((p, i) => (
                  <span key={p.id}>
                    {i ? ' + ' : ''}
                    <Link href={productHref(p.slug)}>{p.title}</Link>
                  </span>
                ))}
              </td>
              <td>
                {t('priceLine', {
                  bundle: f.money(b.bundlePriceCents),
                  regular: f.money(b.priceCents),
                })}
              </td>
              <td>{t(`status_${b.status}`)}</td>
              <td>
                {b.status === 'ACTIVE' ? (
                  <form action={archive}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="btn btn--secondary btn--sm" type="submit">
                      {t('archive')}
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
