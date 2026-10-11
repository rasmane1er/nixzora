import Ionicons from '@expo/vector-icons/Ionicons';
import type { ProductCard as Card } from '@nixzora/validation';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useCartMutation, useToggleWish, useWishlistIds } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand, cardShadow, fonts, radius, space, usePalette } from '@/lib/theme';
import { visitorId } from '@/lib/visitor';
import { BoughtLine, DeliveryLine } from './CardExtras';
import { OfferTag } from '@/components/MultiBuy';
import { CouponTag } from './ClipCoupon';
import { DEAL_RED, DealTimer, useDealLabel } from './DealTimer';
import { PLUS_ACCENT, PlusPriceText } from './PlusNote';
import { PressableLink } from './PressableLink';
import { Price } from './Price';
import { Stars } from './Stars';
import { Swatches } from './Swatches';
import { Text } from './ui';

/**
 * A product in a grid or rail, like the web card: photo with a sale or top-rated badge, a save
 * heart, brand, title, rating, price and "Add to cart" (single-option products) or
 * "Choose options".
 */
export function ProductCard({
  product,
  adToken,
  layout = 'grid',
}: {
  product: Card;
  /** `row`: photo on the left, details beside it, for search results on phones (ADR-0053). */
  layout?: 'grid' | 'row';
  /** A sponsored product (p10-01): labelled, and opening it records the click. */
  adToken?: string;
}) {
  const p = usePalette();
  const t = useT('appShop');
  const tp = useT('product');
  const tpo = useT('preorders');
  const ta = useT('ads');
  const tu = useT('shopUi');
  const dark = useColorScheme() === 'dark';
  const { percent } = useFormatters();
  const dealLabel = useDealLabel();
  const rating = product.rating;
  const row = layout === 'row';
  const onSale = product.compareAtCents != null && product.compareAtCents > product.priceFromCents;
  // Pre-orders (p10-30) first: shoppers need to know it ships later.
  const badge = product.preorder
    ? { top: false, preorder: true, text: tpo('badge') }
    : product.deal
      ? { top: false, deal: true, text: dealLabel(product.deal) }
      : onSale
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
    <View
      style={[
        styles.card,
        cardShadow,
        // The redesign (ADR-0053): lifted cards; a hairline where shadows don't show (dark).
        { backgroundColor: p.card, borderColor: dark ? p.line : 'transparent' },
      ]}
    >
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
        style={({ pressed }) => [
          styles.link,
          row && styles.rowLink,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={[styles.imageWrap, row && styles.rowImage, { backgroundColor: p.photo }]}>
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
        <View style={[styles.body, row && styles.rowBody]}>
          {adToken ? (
            <View style={[styles.sponsored, { borderColor: p.line }]}>
              <Text variant="small" muted style={{ fontSize: 11, fontFamily: fonts.bodyBold }}>
                {ta('sponsored')}
              </Text>
            </View>
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
          {product.colors && !adToken ? (
            <Swatches slug={product.slug} colors={product.colors} />
          ) : null}
          <BoughtLine product={product} />
          <Price
            cents={product.priceFromCents}
            compareAtCents={product.compareAtCents}
            currency={product.currency}
            prefix={product.defaultVariantId ? undefined : tp('from')}
          />
          {onSale && !product.deal ? (
            <View style={[styles.save, { backgroundColor: p.okBg }]}>
              <Text
                variant="small"
                style={{ color: p.okFg, fontFamily: fonts.bodyBold, fontSize: 11 }}
              >
                {tu('savePercent', {
                  percent: percent(1 - product.priceFromCents / (product.compareAtCents as number)),
                })}
              </Text>
            </View>
          ) : null}
          {product.deal?.plusOnly ? (
            <PlusPriceText
              priceCents={product.priceFromCents}
              percentOff={product.deal.percentOff}
            />
          ) : null}
          {product.coupon ? <CouponTag coupon={product.coupon} /> : null}
          {product.multiBuy ? <OfferTag offer={product.multiBuy} /> : null}
          {product.deal ? <DealTimer deal={product.deal} /> : null}
          <DeliveryLine product={product} />
          {!product.inStock ? (
            <Text variant="small" tone="error">
              {tp('soldOut')}
            </Text>
          ) : null}
        </View>
      </PressableLink>
      {badge ? (
        <View
          style={[
            styles.badge,
            row && styles.rowBadge,
            {
              backgroundColor:
                'preorder' in badge
                  ? '#0E1726'
                  : 'deal' in badge
                    ? product.deal?.plusOnly
                      ? PLUS_ACCENT
                      : DEAL_RED
                    : badge.top
                      ? '#2457C5'
                      : brand.signal,
            },
          ]}
          pointerEvents="none"
        >
          <Text variant="small" style={styles.badgeText}>
            {badge.text}
          </Text>
        </View>
      ) : null}
      <CardHeart productId={product.id} title={product.title} />
      <View style={[styles.actions, row && styles.rowActions]}>
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
      style={[styles.heart, cardShadow, { backgroundColor: p.card }]}
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
          backgroundColor: pressed ? brand.signalPressed : brand.signalStrong,
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
  card: { flex: 1, borderWidth: 1, borderRadius: radius + 6 },
  link: { flex: 1, borderRadius: radius + 6, overflow: 'hidden' },
  imageWrap: { aspectRatio: 1.05, alignItems: 'center', justifyContent: 'center', padding: '8%' },
  image: { width: '100%', height: '100%' },
  save: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  body: { padding: space.md, gap: 4 },
  sponsored: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
  },
  actions: { paddingHorizontal: space.md, paddingBottom: space.md },
  rowLink: { flexDirection: 'row', padding: space.md, gap: space.md },
  rowImage: { width: 112, aspectRatio: 112 / 132, borderRadius: 14, padding: 8 },
  rowBody: { flex: 1, padding: 0, paddingRight: 36 },
  rowBadge: { top: space.md + 6, left: space.md + 6, maxWidth: 100 },
  rowActions: { paddingLeft: space.md * 2 + 112, alignItems: 'flex-start' },
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
