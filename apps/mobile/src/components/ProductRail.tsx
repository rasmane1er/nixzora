import type { ProductCard as Card, SponsoredProduct } from '@nixzora/validation';
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
  products = [],
  sponsored,
  inset = space.lg,
}: {
  title: string;
  products?: Card[];
  /** Ads (p10-01): each card is labelled and records its click. */
  sponsored?: SponsoredProduct[];
  inset?: number;
}) {
  const items: { product: Card; token?: string }[] =
    sponsored ?? products.map((product) => ({ product }));
  if (!items.length) return null;
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
        {items.map((item) => (
          <View key={item.product.id} style={{ width: CARD_WIDTH }}>
            <ProductCard product={item.product} adToken={item.token} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
