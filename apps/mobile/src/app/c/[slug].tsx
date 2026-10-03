import { errorMessage } from '@nixzora/api-client';
import type { CategoryNode } from '@nixzora/validation';
import { PressableLink } from '@/components/PressableLink';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ProductGrid } from '@/components/ProductGrid';
import { type Sort, SortChips } from '@/components/SortChips';
import { Banner, EmptyState, Text } from '@/components/ui';
import { useFormatters } from '@/lib/format';
import { useCategories, useProductList } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { space, usePalette } from '@/lib/theme';

function find(nodes: CategoryNode[], slug: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const child = find(node.children, slug);
    if (child) return child;
  }
  return undefined;
}

export default function CategoryScreen() {
  const p = usePalette();
  const t = useT('appShop');
  const { departmentName } = useFormatters();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [sort, setSort] = useState<Sort>('newest');
  const categories = useCategories();
  const category = find(categories.data ?? [], slug);
  const results = useProductList({ category: slug, sort });
  const products = results.data?.pages.flatMap((page) => page.items) ?? [];
  const name = category ? departmentName(category.slug, category.name) : undefined;

  const header = (
    <View style={{ gap: space.md, marginBottom: space.sm }}>
      <Text variant="display">{name ?? ' '}</Text>
      {category?.description ? <Text muted>{category.description}</Text> : null}
      {category?.children.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm }}
        >
          {category.children.map((child) => (
            <PressableLink
              key={child.id}
              href={`/c/${child.slug}`}
              accessibilityRole="link"
              style={{
                borderWidth: 1,
                borderColor: p.line,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 7,
              }}
            >
              <Text variant="small">{departmentName(child.slug, child.name)}</Text>
            </PressableLink>
          ))}
        </ScrollView>
      ) : null}
      <SortChips value={sort} onChange={setSort} options={['newest', 'price_asc', 'price_desc']} />
      {results.error && !results.data ? (
        <Banner tone="error">{errorMessage(results.error)}</Banner>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: name ?? '' }} />
      <ProductGrid
        products={products}
        header={header}
        loadingMore={results.isFetchingNextPage}
        refreshing={results.isRefetching && !results.isFetchingNextPage}
        onRefresh={() => void results.refetch()}
        onEndReached={() => {
          if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
        }}
        empty={
          results.isLoading ? undefined : (
            <EmptyState title={t('nothingHereYet')} body={t('newStockWeekly')} />
          )
        }
      />
    </>
  );
}
