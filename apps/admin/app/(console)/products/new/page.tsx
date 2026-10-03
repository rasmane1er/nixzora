import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner, PageHeader } from '@/components/ui';
import { catalogOptions } from '@/lib/catalog';
import { param, type SearchParams } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { createProduct } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsCatalog');
  return { title: t('metaNewProduct') };
}

export default async function NewProductPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [{ categories, brands }, t, tc] = await Promise.all([
    catalogOptions(),
    getT('opsCatalog'),
    getT('common'),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t('eyebrowCatalog')}
        title={t('metaNewProduct')}
        actions={
          <Link className="btn btn--secondary" href="/products">
            {tc('cancel')}
          </Link>
        }
      />
      <Banner error={param(params, 'error')} />

      <form action={createProduct} className="form">
        <section className="card form">
          <h2>{t('details')}</h2>
          <label>
            {t('title')}
            <input name="title" required minLength={2} maxLength={200} />
          </label>
          <label>
            {t('urlSlug')} <span className="hint">{t('slugHint')}</span>
            <input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="kestrel-14-pro" />
          </label>
          <label>
            {t('description')}
            <textarea name="description" required rows={5} />
          </label>
          <div className="form-row">
            <label>
              {t('category')}
              <select name="categoryId" required defaultValue="">
                <option value="" disabled>
                  {t('choose')}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.isActive
                      ? category.label
                      : t('categoryHidden', { label: category.label })}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('brand')}
              <select name="brandId" defaultValue="">
                <option value="">{t('noBrand')}</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('status')}
              <select name="status" defaultValue="DRAFT">
                <option value="DRAFT">{t('statusDraftHint')}</option>
                <option value="ACTIVE">{t('statusActiveHint')}</option>
              </select>
            </label>
          </div>
          <label>
            {t('specifications')} <span className="hint">{t('specsHint')}</span>
            <textarea name="attributes" rows={5} placeholder={t('specsPlaceholder')} />
          </label>
        </section>

        <section className="card">
          <h2>{t('variants')}</h2>
          <p className="muted">{t('variantsIntro')}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>{t('name')}</th>
                  <th>{t('options')}</th>
                  <th>{t('priceDollars')}</th>
                  <th>{t('wasDollars')}</th>
                  <th>{t('stock')}</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td>
                      <input
                        name={`v${i}.sku`}
                        required={i === 0}
                        placeholder="KES-14-16-512"
                        aria-label={t('variantSkuLabel', { n: i + 1 })}
                      />
                    </td>
                    <td>
                      <input
                        name={`v${i}.title`}
                        placeholder={t('variantNamePlaceholder')}
                        aria-label={t('variantNameLabel', { n: i + 1 })}
                      />
                    </td>
                    <td>
                      <input
                        name={`v${i}.options`}
                        placeholder={t('variantOptionsPlaceholder')}
                        aria-label={t('variantOptionsLabel', { n: i + 1 })}
                      />
                    </td>
                    <td>
                      <input
                        name={`v${i}.price`}
                        inputMode="decimal"
                        required={i === 0}
                        placeholder="1299.00"
                        aria-label={t('variantPriceLabel', { n: i + 1 })}
                      />
                    </td>
                    <td>
                      <input
                        name={`v${i}.compareAt`}
                        inputMode="decimal"
                        aria-label={t('variantWasLabel', { n: i + 1 })}
                      />
                    </td>
                    <td>
                      <input
                        name={`v${i}.stock`}
                        type="number"
                        min={0}
                        defaultValue={0}
                        aria-label={t('variantStockLabel', { n: i + 1 })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">{t('optionsHint')}</p>
        </section>

        <div>
          <SubmitButton>{t('createProduct')}</SubmitButton>
        </div>
      </form>
    </>
  );
}
