import { type CategoryNode } from '@nixzora/validation';
import type { MetadataRoute } from 'next';
import { catalog } from '@/lib/api';
import { SITE_URL } from '@/lib/params';

export const revalidate = 3600;

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    catalog.categories().catch(() => []),
    // Up to 500 products for now; a paged sitemap index comes with a larger catalog.
    Promise.all(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((page) =>
        catalog.products(`?sort=newest&pageSize=50&page=${page}`).catch(() => null),
      ),
    ),
  ]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    ...flatten(categories).map((c) => ({
      url: `${SITE_URL}/c/${c.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...products
      .flatMap((page) => page?.items ?? [])
      .map((p) => ({
        url: `${SITE_URL}/p/${p.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
  ];
}
