import type { ProductCard as Card } from '@nixzora/validation';
import { PressableLink } from './PressableLink';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { radius, space, usePalette } from '@/lib/theme';
import { Price } from './Price';
import { Text } from './ui';

export function ProductCard({ product }: { product: Card }) {
  const p = usePalette();
  return (
    <PressableLink
      href={`/p/${product.slug}`}
      accessibilityRole="link"
      accessibilityLabel={`${product.title}${product.inStock ? '' : ', sold out'}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.imageWrap, { backgroundColor: p.bg }]}>
        {product.image ? (
          <Image
            source={{ uri: product.image.url }}
            alt={product.image.alt ?? product.title}
            style={styles.image}
            contentFit="contain"
            transition={150}
            cachePolicy="disk"
          />
        ) : (
          <Text variant="label" muted>
            No photo
          </Text>
        )}
      </View>
      <View style={styles.body}>
        {product.brand ? (
          <Text variant="label" muted numberOfLines={1}>
            {product.brand.name}
          </Text>
        ) : null}
        <Text variant="small" numberOfLines={2} style={{ minHeight: 36 }}>
          {product.title}
        </Text>
        <Price
          cents={product.priceFromCents}
          compareAtCents={product.compareAtCents}
          currency={product.currency}
        />
        {!product.inStock ? (
          <Text variant="small" tone="error">
            Sold out
          </Text>
        ) : null}
      </View>
    </PressableLink>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: radius, overflow: 'hidden' },
  imageWrap: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  body: { padding: space.md, gap: 4 },
});
