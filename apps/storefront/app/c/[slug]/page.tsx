import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { filtersFrom, ProductListing, toApiQuery } from '@/components/ProductListing';
import { catalog } from '@/lib/api';
import { findCategory } from '@/lib/categories';
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
  return {
    title: found.node.name,
    description:
      found.node.description ??
      `Shop ${found.node.name.toLowerCase()} at NIXZORA: clear specs, fair prices, free shipping over $99.`,
    alternates: { canonical: `/c/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const filters = filtersFrom(await searchParams);
  const [result, brands] = await Promise.all([
    catalog
      .products(toApiQuery({ ...filters, q: undefined }, { category: slug }))
      .catch(() => null),
    catalog.brands().catch(() => []),
  ]);

  return (
    <div className="wrap section">
      <ol className="breadcrumb">
        <li>
          <Link href="/">Home</Link>
        </li>
        {found.trail.map((node) => (
          <li key={node.id}>
            <Link href={`/c/${node.slug}`}>{node.name}</Link>
          </li>
        ))}
      </ol>
      <div className="section-head">
        <div className="stack" style={{ gap: 6 }}>
          <h1>{found.node.name}</h1>
          {found.node.description ? <p className="muted">{found.node.description}</p> : null}
        </div>
      </div>
      {found.node.children.length ? (
        <nav className="hero__chips" style={{ marginBottom: 20 }} aria-label="Subcategories">
          {found.node.children.map((child) => (
            <Link key={child.id} className="btn btn--secondary btn--sm" href={`/c/${child.slug}`}>
              {child.name}
            </Link>
          ))}
        </nav>
      ) : null}
      <ProductListing
        base={`/c/${slug}`}
        filters={{ ...filters, category: slug }}
        result={result ?? { items: [], page: 1, pageSize: 24, total: 0, totalPages: 1 }}
        brands={brands}
      />
    </div>
  );
}
