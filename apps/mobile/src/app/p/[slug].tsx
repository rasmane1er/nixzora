import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import {
  optionAxes,
  optionState,
  pickVariant,
  type ProductDetail,
  SUBSCRIBE_BULK_PERCENT,
  SUBSCRIBE_PERCENT,
  SUBSCRIPTION_INTERVALS,
  type Variant,
} from '@nixzora/validation';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoughtTogether } from '@/components/BoughtTogether';
import { BundleOfferCard } from '@/components/BundleOfferCard';
import { DeliveryPromise } from '@/components/Delivery';
import { PLUS_ACCENT, PlusChip, PlusPriceText } from '@/components/PlusNote';
import { ProductQuestions } from '@/components/ProductQuestions';
import { AddToListButton } from '@/components/AddToListButton';
import { Chips } from '@/components/Chips';
import { DealTimer, DEAL_RED, useDealLabel } from '@/components/DealTimer';
import { StockAlertButton } from '@/components/StockAlertButton';
import { Price } from '@/components/Price';
import { ProductRail } from '@/components/ProductRail';
import { ProductReviews } from '@/components/ProductReviews';
import { ReviewInsightsCard } from '@/components/ReviewInsightsCard';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Stars } from '@/components/Stars';
import { Banner, Button, Card, Divider, EmptyState, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { useFormatters } from '@/lib/format';
import { t as translate, useT } from '@/lib/i18n';
import { READABLE_WIDTH, useLayout } from '@/lib/layout';
import { useCartMutation, useToggleWish, useWishlistIds } from '@/lib/hooks';
import { keys } from '@/lib/query';
import { cardBrand } from '@nixzora/i18n';
import { useSession } from '@/lib/session';
import { visitorId } from '@/lib/visitor';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';

function stockText(variant: Variant): { text: string; tone?: 'error' | 'signal' | 'ok' } {
  const t = translate('productPage');
  if (!variant.isActive || variant.available <= 0)
    return { text: translate('product')('soldOut'), tone: 'error' };
  if (variant.available <= 5)
    return { text: t('onlyLeft', { count: variant.available }), tone: 'signal' };
  return { text: t('inStockShips'), tone: 'ok' };
}

/**
 * Product photos: swipe through them, tap a thumbnail to jump, or tap a photo to see it full
 * screen (swipe there too). A counter shows where you are, however many photos there are.
 */
function Gallery({ product, size }: { product: ProductDetail; size: number }) {
  const p = usePalette();
  const t = useT('appShop');
  const tp = useT('productPage');
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState<number | null>(null);
  const pager = useRef<ScrollView>(null);
  const thumbs = useRef<ScrollView>(null);
  const photos = product.images;

  const show = (to: number, animated = true) => {
    pager.current?.scrollTo({ x: to * size, animated });
    setIndex(to);
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const at = Math.round(event.nativeEvent.contentOffset.x / size);
    if (at !== index && at >= 0 && at < photos.length) {
      setIndex(at);
      thumbs.current?.scrollTo({ x: Math.max(0, at * 72 - width / 2 + 36), animated: true });
    }
  };

  if (!photos.length) {
    return (
      <View style={[styles.noPhoto, { height: size * 0.75, backgroundColor: p.card }]}>
        <Text variant="label" muted>
          {t('noPhotoYet')}
        </Text>
      </View>
    );
  }
  return (
    <View>
      <View>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          accessibilityLabel={tp('photosLabel', { count: photos.length })}
        >
          {photos.map((image, i) => (
            <Pressable
              key={image.id}
              onPress={() => setFull(i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={t('photoSlide', {
                n: i + 1,
                count: photos.length,
                alt: image.alt || product.title,
              })}
            >
              <Image
                source={{ uri: image.url }}
                alt={image.alt || product.title}
                style={{ width: size, height: size * 0.8, backgroundColor: p.card }}
                contentFit="contain"
                cachePolicy="disk"
              />
            </Pressable>
          ))}
        </ScrollView>
        {photos.length > 1 ? (
          <View style={styles.counter} pointerEvents="none">
            <Text variant="mono" style={{ color: '#fff', fontSize: 12 }}>
              {index + 1} / {photos.length}
            </Text>
          </View>
        ) : null}
      </View>

      {photos.length > 1 ? (
        <ScrollView
          ref={thumbs}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: space.sm,
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
          }}
        >
          {photos.map((image, i) => (
            <Pressable
              key={image.id}
              onPress={() => show(i)}
              accessibilityRole="button"
              accessibilityLabel={t('showPhotoN', { n: i + 1 })}
              accessibilityState={{ selected: i === index }}
              style={[
                styles.thumb,
                {
                  borderColor: i === index ? brand.signal : 'transparent',
                  opacity: i === index ? 1 : 0.7,
                },
              ]}
            >
              <Image
                source={{ uri: image.url }}
                style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: p.card }}
                contentFit="cover"
                cachePolicy="disk"
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Modal
        visible={full !== null}
        animationType="fade"
        onRequestClose={() => setFull(null)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <View style={{ flex: 1, backgroundColor: '#0a0a0c' }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (full ?? 0) * width, y: 0 }}
            onMomentumScrollEnd={(event) => {
              const at = Math.round(event.nativeEvent.contentOffset.x / width);
              setFull(at);
              show(at, false);
            }}
          >
            {photos.map((image) => (
              <Image
                key={image.id}
                source={{ uri: image.url }}
                alt={image.alt || product.title}
                style={{ width, height }}
                contentFit="contain"
                cachePolicy="disk"
              />
            ))}
          </ScrollView>
          <Pressable
            onPress={() => setFull(null)}
            accessibilityRole="button"
            accessibilityLabel={t('closePhotos')}
            hitSlop={10}
            style={[styles.close, { top: insets.top + space.sm }]}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          {photos.length > 1 && full !== null ? (
            <View
              style={[
                styles.counter,
                { bottom: insets.bottom + space.lg, right: undefined, alignSelf: 'center' },
              ]}
            >
              <Text variant="mono" style={{ color: '#fff', fontSize: 12 }}>
                {full + 1} / {photos.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

export default function ProductScreen() {
  const p = usePalette();
  const t = useT('appShop');
  const tp = useT('productPage');
  const tc = useT('common');
  const ta = useT('ads');
  const { attributeLabel, optionName, rating, percent, money } = useFormatters();
  const layout = useLayout();
  // Side by side, the photos take a bit over half of the page (up to 760pt).
  const galleryWidth = layout.wide
    ? Math.min(760, Math.round((Math.min(layout.width, 1400) - space.xl * 3) * 0.55))
    : Math.min(layout.width, READABLE_WIDTH);
  const { slug, variant: variantParam } = useLocalSearchParams<{
    slug: string;
    variant?: string;
  }>();
  const { status, user } = useSession();
  const product = useQuery({
    queryKey: keys.product(slug),
    queryFn: () => api.catalog.product(slug),
  });
  const wishIds = useWishlistIds();
  const toggleWish = useToggleWish();
  const [chosen, setChosen] = useState<string | undefined>(variantParam);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  // Bundle & save (p10-16).
  const bundles = useQuery({
    queryKey: ['catalog', 'bundles', slug],
    queryFn: () => api.catalog.bundles(slug),
    enabled: !!product.data,
    staleTime: 60_000,
  });
  const related = useQuery({
    queryKey: ['catalog', 'related', slug],
    queryFn: () => api.catalog.related(slug),
    enabled: !!product.data,
    staleTime: 5 * 60_000,
  });
  const sponsored = useQuery({
    queryKey: ['ads', 'product', slug],
    queryFn: async () =>
      api.ads.forPage({ placement: 'product', product: slug }, await visitorId()),
    enabled: !!product.data,
    staleTime: 5 * 60_000,
  });
  const insights = useQuery({
    queryKey: ['catalog', 'review-insights', slug],
    queryFn: () => api.catalog.reviewInsights(slug),
    enabled: !!product.data,
    staleTime: 5 * 60_000,
  });
  // One view event per product opened, for recommendations (guests use a random visitor id).
  const productId = product.data?.id;
  useEffect(() => {
    if (!productId) return;
    void visitorId()
      .then((id) => api.recommendations.view(productId, id))
      .catch(() => undefined);
  }, [productId]);
  const add = useCartMutation(({ variantId, qty }: { variantId: string; qty: number }) =>
    api.cart.add(variantId, qty),
  );
  const l = useT('lists');
  const dealLabel = useDealLabel();
  const tpl = useT('plus');
  // Buy now (p10-05): its own one-item cart, then straight to checkout.
  const w = useT('wallet');
  // 1-click (p10-09): the default saved card and address, when both exist.
  const oneClickCards = useQuery({
    queryKey: ['payment-cards'],
    queryFn: () => api.account.paymentCards(),
    enabled: status === 'signedIn',
  });
  const oneClickAddresses = useQuery({
    queryKey: keys.addresses,
    queryFn: () => api.account.addresses(),
    enabled: status === 'signedIn',
  });
  const cardsOk = (oneClickCards.data ?? []).filter((c) => !c.expired);
  const oneClickCard = cardsOk.find((c) => c.isDefault) ?? cardsOk[0];
  const oneClickAddress =
    oneClickAddresses.data?.find((a) => a.isDefaultShipping) ?? oneClickAddresses.data?.[0];
  const oneClick = useMutation({
    mutationFn: async ({ variantId, qty }: { variantId: string; qty: number }) => {
      const cart = await api.cart.buyNow(variantId, qty);
      const a = oneClickAddress!;
      return api.checkout.start({
        buyNowId: cart.cartId ?? undefined,
        email: user!.email,
        shippingAddress: {
          fullName: a.fullName,
          line1: a.line1,
          line2: a.line2 || undefined,
          city: a.city,
          region: a.region,
          postalCode: a.postalCode,
          country: a.country,
          phone: a.phone || undefined,
        },
        paymentCardId: oneClickCard!.id,
        useGiftBalance: true,
      });
    },
    onSuccess: (response) => {
      if (!response.paid) return;
      router.push({
        pathname: '/orders/[number]',
        params: { number: response.orderNumber, token: response.accessToken, placed: '1' },
      });
    },
  });
  const ts = useT('subscribe');
  const tib = useT('inbox');
  const tcmp = useT('compare');
  const [subInterval, setSubInterval] = useState<string>('30');
  // Subscribe & Save (p10-11): the first delivery is ordered at once, on the saved card.
  const subscribeNow = useMutation({
    mutationFn: ({ variantId, qty }: { variantId: string; qty: number }) =>
      api.account.subscribe({ variantId, quantity: qty, intervalDays: Number(subInterval) }),
    onSuccess: (result) => {
      const order = result.order;
      if (order?.paid) {
        router.push({
          pathname: '/orders/[number]',
          params: { number: order.orderNumber, token: order.accessToken, placed: '1' },
        });
      }
    },
  });
  const buyNow = useMutation({
    mutationFn: ({ variantId, qty }: { variantId: string; qty: number }) =>
      api.cart.buyNow(variantId, qty),
    onSuccess: (cart) => {
      if (cart.cartId) router.push({ pathname: '/checkout', params: { buy: cart.cartId } });
    },
  });

  if (product.isLoading) {
    return <ActivityIndicator style={{ flex: 1, backgroundColor: p.bg }} />;
  }
  if (!product.data) {
    return (
      <Screen>
        <EmptyState
          title={t('productNotFound')}
          body={product.error ? errorMessage(product.error) : t('mayBeRemoved')}
          action={
            <Button title={t('backToShop')} tone="ghost" onPress={() => router.replace('/')} />
          }
        />
      </Screen>
    );
  }

  const item = product.data;
  const sellable = item.variants.filter((v) => v.isActive);
  const axes = optionAxes(sellable);
  const variant =
    sellable.find((v) => v.id === chosen) ?? sellable.find((v) => v.available > 0) ?? sellable[0];
  const wished = !!wishIds.data?.includes(item.id);
  const stock = variant ? stockText(variant) : { text: t('notAvailable'), tone: 'error' as const };
  const canBuy = !!variant && variant.available > 0;
  const specs = Object.entries(item.attributes);

  const onWish = () => {
    if (status !== 'signedIn') return router.push('/sign-in');
    toggleWish.mutate({ productId: item.id, wished });
  };

  const onAdd = () => {
    if (!variant) return;
    setAdded(false);
    add.mutate(
      { variantId: variant.id, qty: quantity },
      {
        onSuccess: () => {
          setAdded(true);
          if (Platform.OS !== 'web')
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Row style={{ gap: space.lg }}>
              <Pressable
                accessibilityLabel={t('share')}
                hitSlop={8}
                onPress={() =>
                  void Share.share({
                    message: t('shareMessage', { title: item.title }),
                    url: `${WEB_URL}/p/${item.slug}`,
                  })
                }
              >
                <Ionicons name="share-outline" size={22} color={p.fg} />
              </Pressable>
              <Pressable
                accessibilityLabel={wished ? t('removeFromSaved') : t('saveForLater')}
                accessibilityState={{ selected: wished }}
                hitSlop={8}
                onPress={onWish}
              >
                <Ionicons
                  name={wished ? 'heart' : 'heart-outline'}
                  size={23}
                  color={wished ? p.signalText : p.fg}
                />
              </Pressable>
            </Row>
          ),
        }}
      />
      <Screen wide contentContainerStyle={{ padding: 0, gap: 0 }}>
        {/* Tablets: photos beside the details. Phones: photos on top, at a readable width. */}
        <View style={layout.wide ? styles.panes : styles.single}>
          <View style={layout.wide ? { width: galleryWidth } : undefined}>
            <Gallery product={item} size={galleryWidth} />
          </View>
          <View style={[{ padding: space.lg, gap: space.lg }, layout.wide && styles.detailsPane]}>
            <View style={{ gap: space.xs }}>
              {item.brand ? (
                <Text variant="label" muted>
                  {item.brand.name}
                </Text>
              ) : null}
              <Text variant="title">{item.title}</Text>
              <Stars average={item.rating.average} count={item.rating.count} />
              <Text variant="small" muted>
                {tp('soldBy')}{' '}
                {item.seller ? (
                  <Text
                    variant="small"
                    style={{ fontFamily: fonts.bodyMedium, textDecorationLine: 'underline' }}
                    accessibilityRole="link"
                    onPress={() =>
                      void WebBrowser.openBrowserAsync(`${WEB_URL}/s/${item.seller!.handle}`)
                    }
                  >
                    {item.seller.displayName}
                  </Text>
                ) : (
                  <Text variant="small" style={{ fontFamily: fonts.bodyMedium }}>
                    NIXZORA
                  </Text>
                )}
                {item.seller?.rating.count && item.seller.rating.average !== null
                  ? t('sellerRatingInline', {
                      rating: rating(item.seller.rating.average),
                      count: item.seller.rating.count,
                    })
                  : ''}
              </Text>
            </View>

            {item.deal ? (
              <View style={{ gap: space.xs }}>
                <View
                  style={[
                    styles.dealBadge,
                    { backgroundColor: item.deal.plusOnly ? PLUS_ACCENT : DEAL_RED },
                  ]}
                >
                  <Text variant="small" style={{ color: '#fff', fontFamily: fonts.bodyBold }}>
                    {dealLabel(item.deal)}
                  </Text>
                </View>
                {item.deal.plusOnly ? (
                  <PlusPriceText
                    priceCents={item.priceFromCents}
                    percentOff={item.deal.percentOff}
                  />
                ) : null}
                <DealTimer deal={item.deal} />
              </View>
            ) : null}
            {variant ? (
              <Price
                cents={variant.priceCents}
                compareAtCents={variant.compareAtCents}
                currency={variant.currency}
                size="lg"
              />
            ) : null}

            {axes && variant ? (
              axes.map((axis) => (
                <View key={axis.name} style={{ gap: space.sm }}>
                  <Text variant="label" muted>
                    {tp('optionChosen', {
                      name: optionName(axis.name),
                      value: variant.options[axis.name] ?? '',
                    })}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    {axis.values.map((value) => {
                      const active = variant.options[axis.name] === value;
                      const state = optionState(sellable, variant, axis.name, value);
                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={
                            state === 'available' ? value : tp('optionUnavailable', { value })
                          }
                          onPress={() => {
                            setChosen(pickVariant(sellable, variant, axis.name, value).id);
                            setQuantity(1);
                            setAdded(false);
                          }}
                          style={[
                            styles.option,
                            {
                              minWidth: 52,
                              alignItems: 'center',
                              borderColor: active ? p.fg : p.line,
                              backgroundColor: active ? p.card : 'transparent',
                              opacity: state === 'available' ? 1 : 0.5,
                            },
                          ]}
                        >
                          <Text
                            variant="small"
                            style={{
                              fontFamily: active ? fonts.bodyBold : fonts.body,
                              textDecorationLine: state === 'available' ? 'none' : 'line-through',
                            }}
                          >
                            {value}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))
            ) : sellable.length > 1 ? (
              <View style={{ gap: space.sm }}>
                <Text variant="label" muted>
                  {tp('choose')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {sellable.map((v) => {
                    const active = v.id === variant?.id;
                    const out = v.available <= 0;
                    return (
                      <Pressable
                        key={v.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={out ? t('itemSoldOut', { title: v.title }) : v.title}
                        onPress={() => {
                          setChosen(v.id);
                          setQuantity(1);
                          setAdded(false);
                        }}
                        style={[
                          styles.option,
                          {
                            borderColor: active ? p.fg : p.line,
                            backgroundColor: active ? p.card : 'transparent',
                            opacity: out ? 0.5 : 1,
                          },
                        ]}
                      >
                        <Text
                          variant="small"
                          style={{
                            fontFamily: active ? fonts.bodyBold : fonts.body,
                            textDecorationLine: out ? 'line-through' : 'none',
                          }}
                        >
                          {v.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Text variant="small" tone={stock.tone}>
              {stock.text}
            </Text>
            <DeliveryPromise window={item.delivery} />
            {item.seller ? null : (
              // NIXZORA ships it: Plus members get it in 2 days, free (p10-15).
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/plus')}
                style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}
              >
                <PlusChip />
                <Text variant="small" style={{ flexShrink: 1 }}>
                  {tpl('twoDayWithPlus')}
                </Text>
              </Pressable>
            )}

            {canBuy ? (
              <Row style={{ gap: space.lg }}>
                <QuantityStepper
                  value={quantity}
                  max={variant.available}
                  onChange={(next) => setQuantity(Math.max(1, next))}
                />
                <Button
                  title={t('addToCart')}
                  style={{ flex: 1 }}
                  loading={add.isPending}
                  onPress={onAdd}
                />
              </Row>
            ) : (
              <StockAlertButton productId={item.id} />
            )}
            {canBuy && oneClickCard && oneClickAddress && user ? (
              <View style={{ gap: space.xs }}>
                <Button
                  title={w('oneClick')}
                  tone="secondary"
                  loading={oneClick.isPending}
                  onPress={() => oneClick.mutate({ variantId: variant.id, qty: quantity })}
                />
                <Text variant="small" muted>
                  {w('oneClickNote', {
                    name: oneClickAddress.fullName,
                    city: oneClickAddress.city,
                    card: w('cardLabel', {
                      brand: cardBrand(oneClickCard.brand),
                      last4: oneClickCard.last4,
                    }),
                  })}
                </Text>
              </View>
            ) : null}
            {oneClick.error ? <Banner tone="error">{errorMessage(oneClick.error)}</Banner> : null}
            {oneClick.data?.paymentProblem ? (
              <Banner tone="error">{oneClick.data.paymentProblem}</Banner>
            ) : null}
            {canBuy ? (
              <Button
                title={l('buyNow')}
                tone="secondary"
                loading={buyNow.isPending}
                onPress={() => buyNow.mutate({ variantId: variant.id, qty: quantity })}
              />
            ) : null}
            {item.subscribable && canBuy ? (
              <Card style={{ gap: space.sm }}>
                <Text style={{ fontFamily: fonts.bodyBold }}>
                  {ts('subscribeSave', { percent: percent(SUBSCRIBE_PERCENT / 100) })}
                </Text>
                <Text variant="small" muted>
                  {ts('bulkHint', { percent: percent(SUBSCRIBE_BULK_PERCENT / 100) })}
                </Text>
                {status !== 'signedIn' ? (
                  <Button
                    title={ts('signIn')}
                    tone="ghost"
                    onPress={() => router.push('/sign-in')}
                  />
                ) : !oneClickCard || !oneClickAddress ? (
                  <Text variant="small" muted>
                    {ts('needsSetup')}
                  </Text>
                ) : (
                  <>
                    <Text variant="small">{ts('every')}</Text>
                    <Chips<string>
                      value={subInterval}
                      onChange={setSubInterval}
                      options={SUBSCRIPTION_INTERVALS.map((days) => ({
                        value: String(days),
                        label: ts(`interval_${days}`),
                      }))}
                    />
                    <Button
                      title={ts('subscribe', {
                        price: money(
                          Math.round((variant.priceCents * (100 - SUBSCRIBE_PERCENT)) / 100) *
                            quantity,
                          variant.currency,
                        ),
                      })}
                      tone="secondary"
                      loading={subscribeNow.isPending}
                      onPress={() => subscribeNow.mutate({ variantId: variant.id, qty: quantity })}
                    />
                    <Text variant="small" muted>
                      {ts('autoRenew')}
                    </Text>
                  </>
                )}
                {subscribeNow.error ? (
                  <Banner tone="error">{errorMessage(subscribeNow.error)}</Banner>
                ) : null}
                {subscribeNow.data?.order && !subscribeNow.data.order.paid ? (
                  <Banner tone="warn">
                    {subscribeNow.data.order.paymentProblem ?? ts('firstNeedsPayment')}
                  </Banner>
                ) : null}
              </Card>
            ) : null}
            <AddToListButton productId={item.id} />
            {related.data?.similar.length ? (
              <Button
                title={tcmp('similar')}
                tone="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/compare',
                    params: {
                      products: [
                        item.slug,
                        ...related.data!.similar.slice(0, 3).map((x) => x.slug),
                      ].join(','),
                    },
                  })
                }
              />
            ) : null}
            {item.seller ? (
              <Button
                title={tib('askStore')}
                tone="ghost"
                onPress={() =>
                  status === 'signedIn'
                    ? router.push({
                        pathname: '/messages/new',
                        params: {
                          store: item.seller!.handle,
                          name: item.seller!.displayName,
                          product: item.id,
                        },
                      })
                    : router.push('/sign-in')
                }
              />
            ) : null}
            {add.error ? <Banner tone="error">{errorMessage(add.error)}</Banner> : null}
            {buyNow.error ? <Banner tone="error">{errorMessage(buyNow.error)}</Banner> : null}
            {added ? (
              <Banner tone="ok">
                {tp('addedToCart')}{' '}
                <Link
                  href="/cart"
                  style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
                >
                  {t('viewCart')}
                </Link>
              </Banner>
            ) : null}

            <Divider />
            <View style={{ gap: space.sm }}>
              <Text variant="heading">{t('aboutItem')}</Text>
              <Text>{item.description}</Text>
            </View>

            {specs.length ? (
              <Card style={{ gap: 0, paddingVertical: space.sm }}>
                {specs.map(([key, value], i) => (
                  <Row
                    key={key}
                    style={{
                      justifyContent: 'space-between',
                      paddingVertical: space.sm,
                      borderTopWidth: i ? StyleSheet.hairlineWidth : 0,
                      borderColor: p.line,
                    }}
                  >
                    <Text variant="small" muted>
                      {attributeLabel(key)}
                    </Text>
                    <Text
                      variant="small"
                      style={{ fontFamily: fonts.bodyMedium, flexShrink: 1, textAlign: 'right' }}
                    >
                      {typeof value === 'boolean' ? (value ? tc('yes') : tc('no')) : String(value)}
                    </Text>
                  </Row>
                ))}
              </Card>
            ) : null}
            {variant ? (
              <Text variant="mono" muted>
                {tp('sku', { sku: variant.sku })}
              </Text>
            ) : null}

            {insights.data ? <ReviewInsightsCard insights={insights.data} /> : null}
            <ProductReviews slug={slug} />
            <ProductQuestions slug={slug} />

            {(bundles.data ?? []).map((bundle) => (
              <BundleOfferCard key={bundle.id} bundle={bundle} currentId={item.id} />
            ))}

            {(related.data?.boughtTogether ?? []).some((o) => o.inStock && o.defaultVariantId) ? (
              <BoughtTogether
                title={tp('oftenBoughtTogether')}
                current={
                  sellable.filter((v) => v.available > 0).length === 1
                    ? {
                        variantId: sellable.find((v) => v.available > 0)!.id,
                        title: item.title,
                        priceCents: sellable.find((v) => v.available > 0)!.priceCents,
                        image: item.images[0]?.url ?? null,
                      }
                    : null
                }
                others={related.data?.boughtTogether ?? []}
              />
            ) : (
              <ProductRail
                title={tp('oftenBoughtTogether')}
                products={related.data?.boughtTogether ?? []}
              />
            )}
            <ProductRail title={ta('sponsoredRelated')} sponsored={sponsored.data?.ads ?? []} />
            <ProductRail title={tp('similarProducts')} products={related.data?.similar ?? []} />
            <ProductRail title={tp('alsoViewed')} products={related.data?.alsoViewed ?? []} />
          </View>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  panes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xl,
    padding: space.xl,
    width: '100%',
    maxWidth: 1400,
    alignSelf: 'center',
  },
  single: { width: '100%', maxWidth: READABLE_WIDTH, alignSelf: 'center' },
  detailsPane: { flex: 1, padding: 0 },
  counter: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  thumb: { borderWidth: 2, borderRadius: 10, padding: 1 },
  close: {
    position: 'absolute',
    right: space.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  option: { borderWidth: 1, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 10 },
  dealBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
