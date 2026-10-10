import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { filtersFrom, ProductListing, toApiQuery } from '@/components/ProductListing';
import { sponsored } from '@/lib/ads';
import { catalog } from '@/lib/api';
import { findCategory } from '@/lib/categories';
import { departmentName, getT } from '@/lib/i18n';
import { type SearchParams } from '@/lib/params';

type Props = { params: Promise<{ slug: string }>; searchParams: SearchParams };

async function load(slug: string) {
  const tree = await catalog.categories().catch(() => []);
  return findCategory(tree, slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) return {};
  const t = await getT('catalog');
  const name = await departmentName(found.node);
  return {
    title: name,
    description: found.node.description ?? t('categoryDescription', { name: name.toLowerCase() }),
    alternates: { canonical: `/c/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const filters = filtersFrom(await searchParams);
  const firstPage = !filters.page || filters.page === '1';
  const [result, brands, ads] = await Promise.all([
    catalog
      .products(toApiQuery({ ...filters, q: undefined }, { category: slug }))
      .catch(() => null),
    catalog.brands().catch(() => []),
    firstPage ? sponsored({ placement: 'category', category: slug }) : [],
  ]);
  const t = await getT('catalog');
  const trailNames = await Promise.all(found.trail.map((node) => departmentName(node)));
  const childNames = await Promise.all(found.node.children.map((child) => departmentName(child)));

  return (
    <div className="wrap section">
      <ol className="breadcrumb">
        <li>
          <Link href="/">{t('home')}</Link>
        </li>
        {found.trail.map((node, i) => (
          <li key={node.id}>
            <Link href={`/c/${node.slug}`}>{trailNames[i]}</Link>
          </li>
        ))}
      </ol>
      <div className="section-head">
        <div className="stack" style={{ gap: 6 }}>
          <h1>{trailNames[trailNames.length - 1]}</h1>
          {found.node.description ? <p className="muted">{found.node.description}</p> : null}
        </div>
      </div>
      {found.node.children.length ? (
        <nav className="subcats" aria-label={t('subcategories')}>
          {found.node.children.map((child, i) => (
            <Link key={child.id} className="btn btn--secondary btn--sm" href={`/c/${child.slug}`}>
              {childNames[i]}
            </Link>
          ))}
        </nav>
      ) : null}
      <ProductListing
        base={`/c/${slug}`}
        filters={{ ...filters, category: slug }}
        result={result ?? { items: [], page: 1, pageSize: 24, total: 0, totalPages: 1 }}
        brands={brands}
        sponsored={ads}
      />
    </div>
  );
}
