import type { ProductCard as Card } from '@nixzora/validation';
import { type ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { space, usePalette } from '@/lib/theme';
import { ProductCard } from './ProductCard';

/** Two-column product list with pull-to-refresh and endless scrolling. */
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
  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={2}
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
      renderItem={({ item, index }) => (
        // Keep a lone last card at half width.
        <View
          style={{
            flex: 1,
            maxWidth: products.length % 2 && index === products.length - 1 ? '50%' : undefined,
          }}
        >
          <ProductCard product={item} />
        </View>
      )}
    />
  );
}
