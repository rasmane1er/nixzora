import { type Translate } from '@nixzora/i18n';
import { type CategoryNode } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader, StatusPill } from '@/components/ui';
import { catalogOptions } from '@/lib/catalog';
import { param, type SearchParams } from '@/lib/format';
import { getT } from '@/lib/i18n';
import {
  createBrand,
  createCategory,
  deleteCategory,
  renameBrand,
  setCategoryActive,
} from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsCatalog');
  return { title: t('metaCategories') };
}

export default async function CategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [{ tree, categories, brands }, t, tc] = await Promise.all([
    catalogOptions(),
    getT('opsCatalog'),
    getT('common'),
  ]);

  return (
    <>
      <PageHeader eyebrow={t('eyebrowCatalog')} title={t('metaCategories')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />

      <div className="two-col">
        <section className="card">
          <h2>{t('categoryTree')}</h2>
          {tree.length === 0 ? (
            <Empty>{t('noCategories')}</Empty>
          ) : (
            <Tree nodes={tree} t={t} tc={tc} />
          )}
        </section>

        <div>
          <section className="card">
            <h2>{t('newCategory')}</h2>
            <form action={createCategory} className="form">
              <label>
                {t('name')}
                <input name="name" required minLength={2} maxLength={80} />
              </label>
              <label>
                {t('parent')}
                <select name="parentId" defaultValue="">
                  <option value="">{t('topLevel')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('urlSlug')} <span className="hint">{t('optional')}</span>
                <input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
              </label>
              <label>
                {t('order')} <span className="hint">{t('orderHint')}</span>
                <input name="position" type="number" min={0} defaultValue={0} />
              </label>
              <label className="check">
                <input type="checkbox" name="isActive" defaultChecked /> {t('visibleOnStore')}
              </label>
              <div>
                <SubmitButton>{t('createCategory')}</SubmitButton>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>{t('brands')}</h2>
            <form action={createBrand} className="inline-form" style={{ marginBottom: 12 }}>
              <input
                name="name"
                required
                placeholder={t('newBrandName')}
                aria-label={t('newBrandName')}
                style={{ width: 200 }}
              />
              <SubmitButton>{t('add')}</SubmitButton>
            </form>
            {brands.length === 0 ? (
              <Empty>{t('noBrands')}</Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {brands.map((brand) => (
                      <tr key={brand.id}>
                        <td>
                          <form action={renameBrand} className="inline-form">
                            <input type="hidden" name="id" value={brand.id} />
                            <input
                              name="name"
                              defaultValue={brand.name}
                              aria-label={t('nameFor', { brand: brand.name })}
                              style={{ width: 180 }}
                            />
                            <SubmitButton tone="secondary">{t('rename')}</SubmitButton>
                          </form>
                        </td>
                        <td className="mono muted">{brand.slug}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Tree({
  nodes,
  t,
  tc,
}: {
  nodes: CategoryNode[];
  t: Translate<'opsCatalog'>;
  tc: Translate<'common'>;
}) {
  return (
    <ul className="tree">
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="tree__row">
            <div>
              <strong>{node.name}</strong> <span className="muted mono">/{node.slug}</span>
              <div className="muted">
                <Link href={`/products?category=${node.slug}`}>
                  {t('productCount', { count: node.productCount })}
                </Link>
                {node.isActive ? null : (
                  <>
                    {' '}
                    · <StatusPill value="archived" /> {t('hidden')}
                  </>
                )}
              </div>
            </div>
            <div className="inline-form">
              <ActionButton
                action={setCategoryActive}
                label={node.isActive ? t('hide') : t('show')}
                fields={{ id: node.id, isActive: String(!node.isActive) }}
              />
              {node.productCount === 0 && node.children.length === 0 ? (
                <ActionButton
                  action={deleteCategory}
                  label={tc('delete')}
                  tone="danger"
                  fields={{ id: node.id }}
                />
              ) : null}
            </div>
          </div>
          {node.children.length > 0 ? <Tree nodes={node.children} t={t} tc={tc} /> : null}
        </li>
      ))}
    </ul>
  );
}
