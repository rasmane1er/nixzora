import Ionicons from '@expo/vector-icons/Ionicons';
import type { ProductCard as Card } from '@nixzora/validation';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  useColorScheme,
  View,
  type ViewStyle,
} from 'react-native';
import { chipText, INTL_LOCALE } from '@nixzora/i18n';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useCartMutation, useToggleWish, useWishlistIds } from '@/lib/hooks';
import { useLocale, useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand, cardShadow, fonts, radius, space, usePalette } from '@/lib/theme';
import { visitorId } from '@/lib/visitor';
import { BoughtLine, DeliveryLine } from './CardExtras';
import { AwayLine } from './Vacation';
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

  if (row) {
    return (
      <RowCard
        product={product}
        adToken={adToken}
        // In a row the green "Save X%" pill says it, so a sale needs no badge too.
        badge={badge && !('deal' in badge) && !('preorder' in badge) && !badge.top ? null : badge}
        onSale={onSale}
      />
    );
  }

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
        style={({ pressed }) => [styles.link, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={[styles.imageWrap, { backgroundColor: p.photo }]}>
          {product.image ? (
            <Image
              source={{ uri: product.image.url }}
              alt={product.image.alt ?? product.title}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
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
          <Text numberOfLines={2} style={styles.gridTitle}>
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
          {product.storeAway ? (
            <AwayLine until={product.storeAway.until} />
          ) : (
            <DeliveryLine product={product} />
          )}
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
      {/* Vacation mode (p10-32): the line above says when it can be ordered. */}
      {product.storeAway ? null : (
        <View style={styles.actions}>
          <CardAdd product={product} compact />
        </View>
      )}
    </View>
  );
}

type Badge = {
  text: string;
  top: boolean;
  deal?: boolean;
  preorder?: boolean;
} | null;

function badgeColor(badge: NonNullable<Badge>, product: Card): string {
  if ('preorder' in badge && badge.preorder) return '#0E1726';
  if ('deal' in badge && badge.deal) return product.deal?.plusOnly ? PLUS_ACCENT : DEAL_RED;
  return badge.top ? '#2457C5' : brand.signal;
}

/**
 * The row card (search results on phones, ADR-0053): photo with its badge and heart on the
 * left; title, rating, spec chips, price with the saving, delivery and the button on the right.
 */
function RowCard({
  product,
  adToken,
  badge,
  onSale,
}: {
  product: Card;
  adToken?: string;
  badge: Badge;
  onSale: boolean;
}) {
  const p = usePalette();
  const t = useT('appShop');
  const tp = useT('product');
  const ta = useT('ads');
  const tu = useT('shopUi');
  const tch = useT('cardChips');
  const locale = useLocale();
  const dark = useColorScheme() === 'dark';
  const { percent } = useFormatters();
  const [wide, setWide] = useState(false);
  const href = `/p/${product.slug}` as const;
  const label = adToken
    ? ta('sponsoredItem', { title: product.title })
    : product.inStock
      ? product.title
      : t('itemSoldOut', { title: product.title });
  const recordClick = adToken
    ? () => void visitorId().then((id) => api.ads.click(adToken, id).catch(() => undefined))
    : undefined;
  return (
    <View
      style={[
        styles.row,
        cardShadow,
        { backgroundColor: p.card, borderColor: dark ? p.line : 'transparent' },
      ]}
    >
      <View style={styles.rowMedia}>
        <PressableLink
          href={href}
          accessibilityRole="link"
          accessibilityLabel={label}
          onPress={recordClick}
          style={({ pressed }) => [
            styles.rowImage,
            { backgroundColor: p.photo, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {product.image ? (
            <Image
              source={{ uri: product.image.url }}
              alt={product.image.alt ?? product.title}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
            />
          ) : (
            <Text variant="label" muted>
              {t('noPhoto')}
            </Text>
          )}
        </PressableLink>
        {badge ? (
          <View
            style={[styles.badge, styles.rowBadge, { backgroundColor: badgeColor(badge, product) }]}
            pointerEvents="none"
          >
            <Text variant="small" numberOfLines={1} style={styles.badgeText}>
              {badge.text}
            </Text>
          </View>
        ) : null}
        <CardHeart productId={product.id} title={product.title} style={styles.rowHeart} />
      </View>

      <View style={styles.rowBody} onLayout={(e) => setWide(e.nativeEvent.layout.width >= 300)}>
        <PressableLink
          href={href}
          accessibilityRole="link"
          accessibilityLabel={label}
          onPress={recordClick}
          style={{ gap: 4 }}
        >
          {adToken ? (
            <View style={[styles.sponsored, { borderColor: p.line }]}>
              <Text variant="small" muted style={{ fontSize: 11, fontFamily: fonts.bodyBold }}>
                {ta('sponsored')}
              </Text>
            </View>
          ) : null}
          <Text numberOfLines={2} style={styles.rowTitle}>
            {product.title}
          </Text>
        </PressableLink>
        {product.rating?.average != null && product.rating.count ? (
          <Stars average={product.rating.average} count={product.rating.count} />
        ) : null}
        {product.chips?.length ? (
          <View style={styles.chips}>
            {product.chips.map((chip) => (
              <View key={chip.key} style={[styles.chip, { backgroundColor: p.bg }]}>
                <Text variant="small" numberOfLines={1} style={{ fontSize: 12, color: p.muted }}>
                  {chipText(tch, chip, INTL_LOCALE[locale])}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {product.colors && !adToken ? (
          <Swatches slug={product.slug} colors={product.colors} />
        ) : null}
        <View style={styles.priceRow}>
          <Price
            cents={product.priceFromCents}
            compareAtCents={product.compareAtCents}
            currency={product.currency}
            size="lg"
            prefix={product.defaultVariantId ? undefined : tp('from')}
          />
          {onSale ? (
            <View style={[styles.save, { backgroundColor: p.okBg }]}>
              <Text
                variant="small"
                style={{ color: p.okFg, fontFamily: fonts.bodyBold, fontSize: 12 }}
              >
                {tu('savePercent', {
                  percent: percent(1 - product.priceFromCents / (product.compareAtCents as number)),
                })}
              </Text>
            </View>
          ) : null}
        </View>
        {product.deal?.plusOnly ? (
          <PlusPriceText priceCents={product.priceFromCents} percentOff={product.deal.percentOff} />
        ) : null}
        {product.coupon ? <CouponTag coupon={product.coupon} /> : null}
        {product.multiBuy ? <OfferTag offer={product.multiBuy} /> : null}
        {product.deal ? <DealTimer deal={product.deal} /> : null}
        <View style={[styles.rowFoot, wide && styles.rowFootWide]}>
          {product.inStock ? (
            <View style={styles.delivery}>
              {product.storeAway ? (
                <AwayLine until={product.storeAway.until} />
              ) : (
                <DeliveryLine product={product} />
              )}
            </View>
          ) : (
            <Text variant="small" tone="error" style={{ flex: 1 }}>
              {tp('soldOut')}
            </Text>
          )}
          <View style={wide ? null : { alignSelf: 'flex-end' }}>
            {product.storeAway ? null : <CardAdd product={product} compact />}
          </View>
        </View>
      </View>
    </View>
  );
}

function CardHeart({
  productId,
  title,
  style,
}: {
  productId: string;
  title: string;
  style?: StyleProp<ViewStyle>;
}) {
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
      style={[styles.heart, style, cardShadow, { backgroundColor: p.card }]}
    >
      <Ionicons
        name={wished ? 'heart' : 'heart-outline'}
        size={18}
        color={wished ? '#D63B3B' : p.fg}
      />
    </Pressable>
  );
}

function CardAdd({ product, compact }: { product: Card; compact?: boolean }) {
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
          compact && styles.compact,
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
        compact && styles.compact,
        {
          borderColor: 'transparent',
          backgroundColor: pressed ? brand.signalPressed : brand.signalStrong,
        },
      ]}
    >
      {add.isPending ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {compact && !added ? <Ionicons name="cart-outline" size={17} color="#fff" /> : null}
          <Text
            variant="small"
            style={{ color: '#fff', fontFamily: fonts.bodyBold }}
            accessibilityLiveRegion="polite"
          >
            {added ? `✓ ${tp('added')}` : tp('addToCart')}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: radius + 6 },
  link: { flex: 1, borderRadius: radius + 6, overflow: 'hidden' },
  // The redesign (ADR-0053): the photo fills a rounded tile inset in the card.
  imageWrap: {
    margin: 6,
    marginBottom: 0,
    aspectRatio: 1.3,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTitle: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19, minHeight: 38 },
  image: { width: '100%', height: '100%' },
  save: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  body: { paddingHorizontal: space.md, paddingTop: 10, paddingBottom: space.sm, gap: 4 },
  sponsored: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
  },
  actions: { paddingHorizontal: space.md, paddingBottom: space.md },
  badge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 12 },
  heart: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: 40, paddingHorizontal: 14 },
  row: {
    flexDirection: 'row',
    gap: space.md,
    padding: 10,
    borderWidth: 1,
    borderRadius: radius + 6,
  },
  rowMedia: { width: 128 },
  rowImage: {
    width: 128,
    aspectRatio: 0.92,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBadge: { top: 8, left: 8, maxWidth: 112 },
  // On the photo's lower corner, clear of any badge.
  rowHeart: { top: 128 / 0.92 - 42, right: 6 },
  rowBody: { flex: 1, minWidth: 0, gap: 6, paddingTop: 2 },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20, paddingRight: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, maxWidth: '100%' },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rowFoot: { gap: space.sm, marginTop: 2 },
  rowFootWide: { flexDirection: 'row', alignItems: 'center' },
  delivery: { flex: 1 },
  button: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
