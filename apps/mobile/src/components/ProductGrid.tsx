import type { ProductCard as Card } from '@nixzora/validation';
import { type ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useLayout } from '@/lib/layout';
import { space, usePalette } from '@/lib/theme';
import { ProductCard } from './ProductCard';

/**
 * Product list with pull-to-refresh and endless scrolling: two columns on phones, up to five on
 * a large tablet in landscape.
 */
export function ProductGrid({
  products,
  header,
  empty,
  onEndReached,
  loadingMore,
  refreshing = false,
  onRefresh,
}: {
  products: Card[];
  header?: ReactElement;
  empty?: ReactElement;
  onEndReached?: () => void;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const p = usePalette();
  const { width, columns } = useLayout();
  const cardWidth = (width - space.lg * 2 - space.md * (columns - 1)) / columns;
  return (
    <FlatList
      // FlatList cannot change its column count in place: remount when the screen size does.
      key={columns}
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={columns}
      style={{ backgroundColor: p.bg }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 }}
      columnWrapperStyle={{ gap: space.md }}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      onEndReachedThreshold={0.6}
      onEndReached={onEndReached}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
      ListFooterComponent={
        loadingMore ? <ActivityIndicator style={{ marginVertical: space.lg }} /> : null
      }
      renderItem={({ item }) => (
        // A fixed width keeps cards in a short last row the same size as the rest.
        <View style={{ width: cardWidth }}>
          <ProductCard product={item} />
        </View>
      )}
    />
  );
}
