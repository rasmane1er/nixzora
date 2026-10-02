import { type CategoryNode } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader, StatusPill } from '@/components/ui';
import { catalogOptions } from '@/lib/catalog';
import { param, type SearchParams } from '@/lib/format';
import {
  createBrand,
  createCategory,
  deleteCategory,
  renameBrand,
  setCategoryActive,
} from './actions';

export const metadata: Metadata = { title: 'Categories & brands' };

export default async function CategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { tree, categories, brands } = await catalogOptions();

  return (
    <>
      <PageHeader eyebrow="Catalog" title="Categories & brands" />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />

      <div className="two-col">
        <section className="card">
          <h2>Category tree</h2>
          {tree.length === 0 ? <Empty>No categories yet.</Empty> : <Tree nodes={tree} />}
        </section>

        <div>
          <section className="card">
            <h2>New category</h2>
            <form action={createCategory} className="form">
              <label>
                Name
                <input name="name" required minLength={2} maxLength={80} />
              </label>
              <label>
                Parent
                <select name="parentId" defaultValue="">
                  <option value="">Top level</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                URL slug <span className="hint">Optional</span>
                <input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
              </label>
              <label>
                Order <span className="hint">Lower shows first</span>
                <input name="position" type="number" min={0} defaultValue={0} />
              </label>
              <label className="check">
                <input type="checkbox" name="isActive" defaultChecked /> Visible on the store
              </label>
              <div>
                <SubmitButton>Create category</SubmitButton>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>Brands</h2>
            <form action={createBrand} className="inline-form" style={{ marginBottom: 12 }}>
              <input
                name="name"
                required
                placeholder="New brand name"
                aria-label="New brand name"
                style={{ width: 200 }}
              />
              <SubmitButton>Add</SubmitButton>
            </form>
            {brands.length === 0 ? (
              <Empty>No brands yet.</Empty>
            ) : (
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
                            aria-label={`Name for ${brand.name}`}
                            style={{ width: 180 }}
                          />
                          <SubmitButton tone="secondary">Rename</SubmitButton>
                        </form>
                      </td>
                      <td className="mono muted">{brand.slug}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Tree({ nodes }: { nodes: CategoryNode[] }) {
  return (
    <ul className="tree">
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="tree__row">
            <div>
              <strong>{node.name}</strong> <span className="muted mono">/{node.slug}</span>
              <div className="muted">
                <Link href={`/products?category=${node.slug}`}>{node.productCount} products</Link>
                {node.isActive ? null : (
                  <>
                    {' '}
                    · <StatusPill value="archived" /> hidden
                  </>
                )}
              </div>
            </div>
            <div className="inline-form">
              <ActionButton
                action={setCategoryActive}
                label={node.isActive ? 'Hide' : 'Show'}
                fields={{ id: node.id, isActive: String(!node.isActive) }}
              />
              {node.productCount === 0 && node.children.length === 0 ? (
                <ActionButton
                  action={deleteCategory}
                  label="Delete"
                  tone="danger"
                  fields={{ id: node.id }}
                />
              ) : null}
            </div>
          </div>
          {node.children.length > 0 ? <Tree nodes={node.children} /> : null}
        </li>
      ))}
    </ul>
  );
}
