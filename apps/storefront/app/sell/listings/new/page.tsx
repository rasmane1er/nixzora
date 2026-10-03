import type { Metadata } from 'next';
import { Notices, SellerNav } from '@/components/SellerNav';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { categoryOptions, requireSeller } from '@/lib/sell';
import { createListing } from '../../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sellerTools');
  return { title: t('metaAddListing'), robots: { index: false } };
}

export default async function NewListingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [seller, categories, t] = await Promise.all([
    requireSeller('/sell/listings/new'),
    categoryOptions(),
    getT('sellerTools'),
  ]);
  const blocked = seller.status === 'SUSPENDED' || seller.status === 'REJECTED';

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/listings" />
      <Notices error={param(params, 'error')} />
      {blocked ? (
        <p className="banner banner--error">{t('cannotAddListings')}</p>
      ) : (
        <form action={createListing} className="card form" style={{ maxWidth: 760 }}>
          <h2>{t('addListing')}</h2>
          <p className="muted">{t('newListingIntro')}</p>
          <label>
            {t('fieldProductName')}
            <input name="title" required minLength={2} maxLength={200} />
          </label>
          <label>
            {t('fieldCategory')}
            <select name="categoryId" required defaultValue="">
              <option value="" disabled>
                {t('chooseCategory')}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('fieldDescription')}
            <textarea name="description" rows={5} required maxLength={20000} />
          </label>
          <label>
            {t('fieldSpecs')} <span className="hint">{t('specsHintNew')}</span>
            <textarea name="specs" rows={4} placeholder={'weight_g: 250\nbluetooth: 5.4'} />
          </label>
          <fieldset className="form" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>
              <strong>{t('priceAndStock')}</strong>{' '}
              <span className="hint">{t('priceAndStockHint')}</span>
            </legend>
            <div className="form-row">
              <label>
                {t('fieldSku')} <span className="hint">{t('skuHint')}</span>
                <input
                  name="sku"
                  required
                  pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,63}"
                  placeholder="BL-SPK-WAL"
                />
              </label>
              <label>
                {t('fieldOptionName')}
                <input name="variantTitle" placeholder={t('optionPlaceholder')} maxLength={120} />
              </label>
            </div>
            <div className="form-row">
              <label>
                {t('fieldPrice')}
                <input name="price" required inputMode="decimal" placeholder="249.00" />
              </label>
              <label>
                {t('fieldWas')} <span className="hint">{t('hintOptional')}</span>
                <input name="compareAt" inputMode="decimal" placeholder="299.00" />
              </label>
              <label>
                {t('fieldInStock')}
                <input name="stock" type="number" min={0} max={1000000} defaultValue={0} />
              </label>
            </div>
          </fieldset>
          <div>
            <button className="btn btn--primary" type="submit">
              {t('saveDraft')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
