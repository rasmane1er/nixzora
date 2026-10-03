import type { Metadata } from 'next';
import { filtersFrom, ProductListing, toApiQuery } from '@/components/ProductListing';
import { catalog } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { type SearchParams } from '@/lib/params';

type Props = { searchParams: SearchParams };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = filtersFrom(await searchParams);
  const t = await getT('catalog');
  return {
    title: q ? t('quotedQuery', { q }) : t('allProducts'),
    robots: { index: !q, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const filters = filtersFrom(await searchParams);
  const [result, brands] = await Promise.all([
    catalog.products(toApiQuery(filters)).catch(() => null),
    catalog.brands().catch(() => []),
  ]);
  const t = await getT('catalog');

  return (
    <div className="wrap section">
      <div className="section-head">
        <div className="stack" style={{ gap: 6 }}>
          <p className="eyebrow">{filters.q ? t('searchEyebrow') : t('catalogEyebrow')}</p>
          <h1>{filters.q ? t('resultsFor', { q: filters.q }) : t('allProducts')}</h1>
        </div>
      </div>
      <ProductListing
        base="/search"
        filters={filters}
        result={result ?? { items: [], page: 1, pageSize: 24, total: 0, totalPages: 1 }}
        brands={brands}
      />
    </div>
  );
}
