import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { FollowButton } from '@/components/FollowButton';
import { ProductGrid } from '@/components/ProductGrid';
import { EmptyState, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';

/** A marketplace store in the app (p10-24): who they are, follow, and their products. */
export default function StoreScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const t = useT('store');
  const tp = useT('product');
  const tf = useT('follows');
  const p = usePalette();
  const store = useQuery({ queryKey: ['store', handle], queryFn: () => api.catalog.store(handle) });
  const products = useInfiniteQuery({
    queryKey: ['store-products', handle],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.catalog.products({ seller: handle, page: pageParam, pageSize: 24 }),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: !!store.data,
  });
  if (store.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  const s = store.data;
  if (!s) return <EmptyState title={tf('storeNotFound')} />;
  const items = products.data?.pages.flatMap((page) => page.items) ?? [];
  const header = (
    <View style={{ gap: space.md, paddingBottom: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        {s.logoUrl ? (
          <Image
            source={{ uri: s.logoUrl }}
            alt=""
            style={{ width: 64, height: 64, borderRadius: 14 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              backgroundColor: p.tile,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: p.tileFg, fontFamily: fonts.display, fontSize: 26 }}>
              {s.displayName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" tone="signal">
            {t('marketplaceSeller')}
          </Text>
          <Text variant="title">{s.displayName}</Text>
          <Text variant="small" muted>
            {tp('products', { count: s.productCount })} · {t('sales', { count: s.salesCount })}
          </Text>
        </View>
      </View>
      <FollowButton handle={s.handle} store={s.displayName} />
      {s.description ? <Text>{s.description}</Text> : null}
    </View>
  );
  return (
    <>
      <Stack.Screen options={{ title: s.displayName }} />
      <ProductGrid
        products={items}
        header={header}
        loadingMore={products.isFetchingNextPage}
        onEndReached={() => {
          if (products.hasNextPage && !products.isFetchingNextPage) void products.fetchNextPage();
        }}
        refreshing={products.isRefetching}
        onRefresh={() => void products.refetch()}
      />
    </>
  );
}
