import { type VisualSearchResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PhotoSearch } from '@/components/PhotoSearch';
import { ProductCard } from '@/components/ProductCard';
import { api, ApiError } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('photo');
  return {
    title: t('metaTitle'),
    description: t('lead'),
    alternates: { canonical: '/search/photo' },
    // Result pages are one shopper's photo search; only the empty page belongs in search engines.
    robots: { index: false },
  };
}

/** Search by photo (p10-14): the upload box, and the matches for `?r=<result id>`. */
export default async function PhotoSearchPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT('photo');
  const id = param(await searchParams, 'r');
  let result: VisualSearchResult | null = null;
  let problem: string | null = null;
  if (id && /^[0-9a-f-]{36}$/.test(id)) {
    result = await api<VisualSearchResult>(`/catalog/visual-search/${id}`).catch(
      (error: unknown) => {
        problem = error instanceof ApiError && error.status === 404 ? t('expired') : t('failed');
        return null;
      },
    );
  }
  const labels = {
    choose: t(result ? 'another' : 'choose'),
    drop: t('drop'),
    formats: t('formats'),
    searching: t('searching'),
    privacy: t('privacy'),
    tooLarge: t('tooLarge'),
    unreadable: t('unreadable'),
    failed: t('failed'),
    yourPhoto: t('yourPhoto'),
  };

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 6 }}>
        <h1>{result ? t('resultsTitle') : t('title')}</h1>
        {result ? (
          <p className="muted">
            {t('resultsCount', { count: result.products.length })}
            {result.query ? (
              <>
                {' · '}
                {t('looksLike', { query: result.query })}
                {' · '}
                <Link href={`/search?q=${encodeURIComponent(result.query)}`}>
                  {t('searchWords', { query: result.query })}
                </Link>
              </>
            ) : null}
            {result.category ? (
              <>
                {' · '}
                <Link href={`/c/${result.category.slug}`}>
                  {t('inCategory', { category: result.category.name })}
                </Link>
              </>
            ) : null}
          </p>
        ) : (
          <p className="muted" style={{ maxWidth: 680 }}>
            {t('lead')}
          </p>
        )}
      </div>

      {problem ? (
        <p className="banner banner--error" role="alert">
          {problem}
        </p>
      ) : null}

      <PhotoSearch labels={labels} compact={Boolean(result)} />
      {result ? null : <p className="hint">{t('tips')}</p>}

      {result ? (
        result.products.length ? (
          <div className="grid">
            {result.products.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>
        ) : (
          <p className="banner banner--info">{t('none')}</p>
        )
      ) : null}
    </div>
  );
}
