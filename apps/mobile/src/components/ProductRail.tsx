import type { ProductCard as Card } from '@nixzora/validation';
import { ScrollView, View } from 'react-native';
import { space } from '@/lib/theme';
import { ProductCard } from './ProductCard';
import { Text } from './ui';

const CARD_WIDTH = 168;

/**
 * A titled row of product cards that scrolls sideways (similar products, bought together…).
 * Bleeds to the screen edges; `inset` is the parent's horizontal padding.
 */
export function ProductRail({
  title,
  products,
  inset = space.lg,
}: {
  title: string;
  products: Card[];
  inset?: number;
}) {
  if (!products.length) return null;
  return (
    <View style={{ gap: space.sm }} accessibilityRole="list" accessibilityLabel={title}>
      <Text variant="heading">{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + space.md}
        decelerationRate="fast"
        style={{ marginHorizontal: -inset }}
        contentContainerStyle={{ paddingHorizontal: inset, gap: space.md }}
      >
        {products.map((product) => (
          <View key={product.id} style={{ width: CARD_WIDTH }}>
            <ProductCard product={product} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
