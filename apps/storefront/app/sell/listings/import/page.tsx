import type { Metadata } from 'next';
import { SellerNav } from '@/components/SellerNav';
import { getFormat, getT } from '@/lib/i18n';
import { requireSeller } from '@/lib/sell';
import { ImportForm } from './ImportForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sellerTools');
  return { title: t('metaImport'), robots: { index: false } };
}

/** CSV column names stay English (they are the file format); their help is translated. */
const COLUMNS = [
  'product',
  'title',
  'category',
  'description',
  'specs',
  'sku',
  'option',
  'price',
  'compare_at_price',
  'stock',
  'barcode',
] as const;

export default async function ImportListingsPage() {
  const seller = await requireSeller('/sell/listings/import');
  const [t, f] = await Promise.all([getT('sellerTools'), getFormat()]);
  const blocked = seller.status === 'SUSPENDED' || seller.status === 'REJECTED';

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/listings" />
      <div className="two-col-sell">
        <section className="card stack">
          <h2>{t('importTitle')}</h2>
          <p className="muted">{t('importIntro')}</p>
          <p>
            <a className="btn btn--secondary btn--sm" href="/sell/listings/template.csv">
              {t('downloadTemplate')}
            </a>{' '}
            <a className="btn btn--secondary btn--sm" href="/sell/listings/export.csv">
              {t('downloadListings')}
            </a>
          </p>
          {blocked ? (
            <p className="banner banner--error">{t('cannotChangeListings')}</p>
          ) : (
            <ImportForm />
          )}
        </section>
        <section className="card stack">
          <h2>{t('columnsTitle')}</h2>
          <dl className="facts">
            {COLUMNS.map((name) => (
              <div key={name} style={{ display: 'contents' }}>
                <dt className="mono">{name}</dt>
                <dd>{t(`col_${name}`)}</dd>
              </div>
            ))}
          </dl>
          <p className="muted" style={{ fontSize: 14 }}>
            {t('importFootnote', { max: f.number(2000) })}
          </p>
        </section>
      </div>
    </div>
  );
}
