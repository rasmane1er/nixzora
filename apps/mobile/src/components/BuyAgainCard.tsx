import type { BuyAgainItem } from '@nixzora/validation';
import { Image } from 'expo-image';
import { type DimensionValue, View } from 'react-native';
import { PressableLink } from './PressableLink';
import { Button, Text } from './ui';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useCartMutation } from '@/lib/hooks';
import { fonts, radius, space, usePalette } from '@/lib/theme';

/** A product the customer ordered before, with a one-tap "Add to cart". */
export function BuyAgainCard({
  item,
  width = 160,
}: {
  item: BuyAgainItem;
  width?: DimensionValue;
}) {
  const p = usePalette();
  const add = useCartMutation(() => api.cart.add(item.variantId, 1));
  return (
    <View
      style={{
        width,
        gap: 6,
        padding: space.sm,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: p.line,
        backgroundColor: p.card,
      }}
    >
      <PressableLink href={`/p/${item.slug}`} accessibilityRole="link">
        <Image
          source={{ uri: item.imageUrl ?? undefined }}
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: p.bg }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <Text
          variant="small"
          numberOfLines={2}
          style={{ fontFamily: fonts.bodyMedium, marginTop: 6 }}
        >
          {item.title}
        </Text>
      </PressableLink>
      {item.variantTitle && item.variantTitle !== 'Default' ? (
        <Text variant="small" muted numberOfLines={1}>
          {item.variantTitle}
        </Text>
      ) : null}
      <Text variant="small" muted>
        {money(item.priceCents, item.currency)}
      </Text>
      <Button
        title={add.isSuccess ? 'Added' : item.inStock ? 'Add to cart' : 'Out of stock'}
        tone="secondary"
        disabled={!item.inStock || add.isSuccess}
        loading={add.isPending}
        onPress={() => add.mutate(undefined)}
      />
    </View>
  );
}
