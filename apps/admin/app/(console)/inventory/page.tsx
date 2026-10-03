import { rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { param, query, type SearchParams } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { adjustStock } from '../products/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsCatalog');
  return { title: t('metaInventory') };
}

type StockRow = {
  variantId: string;
  sku: string;
  variantTitle: string;
  productId: string;
  productTitle: string;
  onHand: number;
  reserved: number;
  available: number;
};

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const lowStock = param(params, 'lowStock');
  const [me, rows, t, tc] = await Promise.all([
    currentStaff(),
    load<StockRow[]>(`/admin/inventory${query({ q, lowStock })}`),
    getT('opsCatalog'),
    getT('common'),
  ]);
  const back = `/inventory${query({ q, lowStock })}`;

  return (
    <>
      <PageHeader eyebrow={t('eyebrowOperations')} title={t('metaInventory')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />

      <form className="toolbar" role="search">
        <label>
          {tc('search')}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t('inventorySearchPlaceholder')}
          />
        </label>
        <label>
          {t('show')}
          <select name="lowStock" defaultValue={lowStock ?? ''}>
            <option value="">{t('allVariants')}</option>
            <option value="0">{t('soldOut')}</option>
            <option value="5">{t('orFewerAvailable', { n: 5 })}</option>
            <option value="20">{t('orFewerAvailable', { n: 20 })}</option>
          </select>
        </label>
        <button className="btn btn--secondary" type="submit">
          {t('filter')}
        </button>
      </form>

      <section className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          {rich(t('stockLegend'), {
            onHand: (chunk) => <strong key="onHand">{chunk}</strong>,
            held: (chunk) => <strong key="held">{chunk}</strong>,
            available: (chunk) => <strong key="available">{chunk}</strong>,
          })}
        </p>
        {rows.length === 0 ? (
          <Empty>{t('noVariantsMatch')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>{t('colProduct')}</th>
                  <th className="num">{t('colOnHand')}</th>
                  <th className="num">{t('colHeld')}</th>
                  <th className="num">{t('colAvailable')}</th>
                  <th>{t('colAdjust')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.variantId}>
                    <td className="mono">{row.sku}</td>
                    <td>
                      {can(me, 'catalog.write') ? (
                        <Link href={`/products/${row.productId}`}>{row.productTitle}</Link>
                      ) : (
                        row.productTitle
                      )}
                      <div className="muted">{row.variantTitle}</div>
                    </td>
                    <td className="num">{row.onHand}</td>
                    <td className="num">{row.reserved}</td>
                    <td className={`num${row.available <= 5 ? ' low' : ''}`}>{row.available}</td>
                    <td>
                      <form action={adjustStock} className="inline-form">
                        <input type="hidden" name="variantId" value={row.variantId} />
                        <input type="hidden" name="back" value={back} />
                        <input
                          name="delta"
                          type="number"
                          required
                          placeholder="+10"
                          aria-label={t('changeFor', { sku: row.sku })}
                          style={{ width: 70 }}
                        />
                        <select name="reason" defaultValue="RECEIVED" aria-label={t('reason')}>
                          <option value="RECEIVED">{t('reason_RECEIVED')}</option>
                          <option value="CORRECTION">{t('reason_CORRECTION')}</option>
                          <option value="DAMAGED">{t('reason_DAMAGED')}</option>
                          <option value="RETURNED">{t('reason_RETURNED')}</option>
                        </select>
                        <input
                          name="note"
                          placeholder={t('note')}
                          aria-label={t('note')}
                          style={{ width: 120 }}
                        />
                        <SubmitButton tone="secondary">{t('apply')}</SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length === 500 ? <p className="muted">{t('firstRows', { count: 500 })}</p> : null}
      </section>
    </>
  );
}
