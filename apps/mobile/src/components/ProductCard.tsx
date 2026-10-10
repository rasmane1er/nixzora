import Ionicons from '@expo/vector-icons/Ionicons';
import type { ProductCard as Card } from '@nixzora/validation';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useCartMutation, useToggleWish, useWishlistIds } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';
import { visitorId } from '@/lib/visitor';
import { PressableLink } from './PressableLink';
import { Price } from './Price';
import { Stars } from './Stars';
import { Text } from './ui';

/**
 * A product in a grid or rail, like the web card: photo with a sale or top-rated badge, a save
 * heart, brand, title, rating, price and "Add to cart" (single-option products) or
 * "Choose options".
 */
export function ProductCard({
  product,
  adToken,
}: {
  product: Card;
  /** A sponsored product (p10-01): labelled, and opening it records the click. */
  adToken?: string;
}) {
  const p = usePalette();
  const t = useT('appShop');
  const tp = useT('product');
  const ta = useT('ads');
  const { percent } = useFormatters();
  const rating = product.rating;
  const onSale = product.compareAtCents != null && product.compareAtCents > product.priceFromCents;
  const badge = onSale
    ? {
        top: false,
        text: tp('sale', {
          percent: percent(1 - product.priceFromCents / (product.compareAtCents as number)),
        }),
      }
    : rating?.average != null && rating.average >= 4.5 && rating.count >= 3
      ? { top: true, text: tp('topRated') }
      : null;

  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.line }]}>
      <PressableLink
        href={`/p/${product.slug}`}
        accessibilityRole="link"
        accessibilityLabel={
          adToken
            ? ta('sponsoredItem', { title: product.title })
            : product.inStock
              ? product.title
              : t('itemSoldOut', { title: product.title })
        }
        // Best-effort: the product opens whether or not the click is recorded.
        onPress={
          adToken
            ? () => void visitorId().then((id) => api.ads.click(adToken, id).catch(() => undefined))
            : undefined
        }
        style={({ pressed }) => [styles.link, { opacity: pressed ? 0.85 : 1 }]}
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
              {t('noPhoto')}
            </Text>
          )}
        </View>
        <View style={styles.body}>
          {adToken ? (
            <View style={[styles.sponsored, { borderColor: p.line }]}>
              <Text variant="small" muted style={{ fontSize: 11, fontFamily: fonts.bodyBold }}>
                {ta('sponsored')}
              </Text>
            </View>
          ) : null}
          {product.brand ? (
            <Text variant="label" muted numberOfLines={1}>
              {product.brand.name}
            </Text>
          ) : null}
          <Text
            variant="small"
            numberOfLines={2}
            style={{ minHeight: 36, fontFamily: fonts.bodyMedium }}
          >
            {product.title}
          </Text>
          {rating?.average != null && rating.count ? (
            <Stars average={rating.average} count={rating.count} />
          ) : null}
          <Price
            cents={product.priceFromCents}
            compareAtCents={product.compareAtCents}
            currency={product.currency}
            prefix={product.defaultVariantId ? undefined : tp('from')}
          />
          {!product.inStock ? (
            <Text variant="small" tone="error">
              {tp('soldOut')}
            </Text>
          ) : null}
        </View>
      </PressableLink>
      {badge ? (
        <View
          style={[styles.badge, { backgroundColor: badge.top ? '#2457C5' : brand.signal }]}
          pointerEvents="none"
        >
          <Text variant="small" style={styles.badgeText}>
            {badge.text}
          </Text>
        </View>
      ) : null}
      <CardHeart productId={product.id} title={product.title} />
      <View style={styles.actions}>
        <CardAdd product={product} />
      </View>
    </View>
  );
}

function CardHeart({ productId, title }: { productId: string; title: string }) {
  const p = usePalette();
  const tp = useT('product');
  const { status } = useSession();
  const ids = useWishlistIds();
  const toggle = useToggleWish();
  const wished = !!ids.data?.includes(productId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={wished ? tp('saved', { title }) : tp('save', { title })}
      accessibilityState={{ selected: wished }}
      hitSlop={6}
      onPress={() => {
        if (status !== 'signedIn') return router.push('/sign-in');
        toggle.mutate({ productId, wished });
      }}
      style={[styles.heart, { backgroundColor: p.card, borderColor: p.line }]}
    >
      <Ionicons
        name={wished ? 'heart' : 'heart-outline'}
        size={18}
        color={wished ? '#D63B3B' : p.fg}
      />
    </Pressable>
  );
}

function CardAdd({ product }: { product: Card }) {
  const p = usePalette();
  const tp = useT('product');
  const [added, setAdded] = useState(false);
  const add = useCartMutation((variantId: string) => api.cart.add(variantId, 1));
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 2000);
    return () => clearTimeout(timer);
  }, [added]);

  if (!product.inStock) return null;
  const variantId = product.defaultVariantId;
  if (!variantId) {
    return (
      <PressableLink
        href={`/p/${product.slug}`}
        accessibilityRole="button"
        accessibilityLabel={tp('chooseOptionsFor', { title: product.title })}
        style={({ pressed }) => [
          styles.button,
          { borderColor: p.line, backgroundColor: pressed ? p.line : p.card },
        ]}
      >
        <Text variant="small" style={{ fontFamily: fonts.bodyBold }}>
          {tp('chooseOptions')}
        </Text>
      </PressableLink>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tp('addTitleToCart', { title: product.title })}
      accessibilityState={{ busy: add.isPending }}
      disabled={add.isPending}
      onPress={() => add.mutate(variantId, { onSuccess: () => setAdded(true) })}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: 'transparent',
          backgroundColor: pressed ? brand.signalPressed : brand.signal,
        },
      ]}
    >
      {add.isPending ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text
          variant="small"
          style={{ color: '#fff', fontFamily: fonts.bodyBold }}
          accessibilityLiveRegion="polite"
        >
          {added ? `✓ ${tp('added')}` : tp('addToCart')}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: radius, overflow: 'hidden' },
  link: { flex: 1 },
  imageWrap: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  body: { padding: space.md, gap: 4 },
  sponsored: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
  },
  actions: { paddingHorizontal: space.md, paddingBottom: space.md },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 12 },
  heart: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
