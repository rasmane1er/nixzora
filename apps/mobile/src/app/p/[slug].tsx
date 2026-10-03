import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import type { ProductDetail, Variant } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Price } from '@/components/Price';
import { ProductRail } from '@/components/ProductRail';
import { ReviewInsightsCard } from '@/components/ReviewInsightsCard';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Stars } from '@/components/Stars';
import { Banner, Button, Card, Divider, EmptyState, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { attributeLabel } from '@/lib/format';
import { useCartMutation, useToggleWish, useWishlistIds } from '@/lib/hooks';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { visitorId } from '@/lib/visitor';
import { fonts, radius, space, usePalette } from '@/lib/theme';

function stockText(variant: Variant): { text: string; tone?: 'error' | 'signal' | 'ok' } {
  if (!variant.isActive || variant.available <= 0) return { text: 'Sold out', tone: 'error' };
  if (variant.available <= 5) return { text: `Only ${variant.available} left`, tone: 'signal' };
  return { text: 'In stock · ships in 1–2 business days', tone: 'ok' };
}

function Gallery({ product }: { product: ProductDetail }) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const size = Math.min(width, 640);
  if (!product.images.length) {
    return (
      <View style={[styles.noPhoto, { height: size * 0.75, backgroundColor: p.card }]}>
        <Text variant="label" muted>
          No photo yet
        </Text>
      </View>
    );
  }
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / size))
        }
      >
        {product.images.map((image) => (
          <Image
            key={image.id}
            source={{ uri: image.url }}
            alt={image.alt || product.title}
            style={{ width: size, height: size * 0.8, backgroundColor: p.card }}
            contentFit="contain"
            cachePolicy="disk"
          />
        ))}
      </ScrollView>
      {product.images.length > 1 ? (
        <Row style={{ justifyContent: 'center', marginTop: space.sm }}>
          {product.images.map((image, i) => (
            <View
              key={image.id}
              style={[styles.dot, { backgroundColor: i === index ? p.fg : p.line }]}
            />
          ))}
        </Row>
      ) : null}
    </View>
  );
}

export default function ProductScreen() {
  const p = usePalette();
  const { slug, variant: variantParam } = useLocalSearchParams<{
    slug: string;
    variant?: string;
  }>();
  const { status } = useSession();
  const product = useQuery({
    queryKey: keys.product(slug),
    queryFn: () => api.catalog.product(slug),
  });
  const wishIds = useWishlistIds();
  const toggleWish = useToggleWish();
  const [chosen, setChosen] = useState<string | undefined>(variantParam);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const related = useQuery({
    queryKey: ['catalog', 'related', slug],
    queryFn: () => api.catalog.related(slug),
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

  if (product.isLoading) {
    return <ActivityIndicator style={{ flex: 1, backgroundColor: p.bg }} />;
  }
  if (!product.data) {
    return (
      <Screen>
        <EmptyState
          title="Product not found"
          body={product.error ? errorMessage(product.error) : 'It may have been removed.'}
          action={
            <Button title="Back to the shop" tone="ghost" onPress={() => router.replace('/')} />
          }
        />
      </Screen>
    );
  }

  const item = product.data;
  const sellable = item.variants.filter((v) => v.isActive);
  const variant =
    sellable.find((v) => v.id === chosen) ?? sellable.find((v) => v.available > 0) ?? sellable[0];
  const wished = !!wishIds.data?.includes(item.id);
  const stock = variant ? stockText(variant) : { text: 'Not available', tone: 'error' as const };
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
                accessibilityLabel="Share"
                hitSlop={8}
                onPress={() =>
                  void Share.share({
                    message: `${item.title} on NIXZORA`,
                    url: `${WEB_URL}/p/${item.slug}`,
                  })
                }
              >
                <Ionicons name="share-outline" size={22} color={p.fg} />
              </Pressable>
              <Pressable
                accessibilityLabel={wished ? 'Remove from saved' : 'Save for later'}
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
      <Screen contentContainerStyle={{ padding: 0, gap: 0 }}>
        <Gallery product={item} />
        <View style={{ padding: space.lg, gap: space.lg }}>
          <View style={{ gap: space.xs }}>
            {item.brand ? (
              <Text variant="label" muted>
                {item.brand.name}
              </Text>
            ) : null}
            <Text variant="title">{item.title}</Text>
            <Stars average={item.rating.average} count={item.rating.count} />
          </View>

          {variant ? (
            <Price
              cents={variant.priceCents}
              compareAtCents={variant.compareAtCents}
              currency={variant.currency}
              size="lg"
            />
          ) : null}

          {sellable.length > 1 ? (
            <View style={{ gap: space.sm }}>
              <Text variant="label" muted>
                Choose
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
                      accessibilityLabel={`${v.title}${out ? ', sold out' : ''}`}
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

          {canBuy ? (
            <Row style={{ gap: space.lg }}>
              <QuantityStepper
                value={quantity}
                max={variant.available}
                onChange={(next) => setQuantity(Math.max(1, next))}
              />
              <Button
                title="Add to cart"
                style={{ flex: 1 }}
                loading={add.isPending}
                onPress={onAdd}
              />
            </Row>
          ) : null}
          {add.error ? <Banner tone="error">{errorMessage(add.error)}</Banner> : null}
          {added ? (
            <Banner tone="ok">
              Added to your cart.{' '}
              <Link
                href="/cart"
                style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
              >
                View cart
              </Link>
            </Banner>
          ) : null}

          <Divider />
          <View style={{ gap: space.sm }}>
            <Text variant="heading">About this item</Text>
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
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                  </Text>
                </Row>
              ))}
            </Card>
          ) : null}
          {variant ? (
            <Text variant="mono" muted>
              SKU {variant.sku}
            </Text>
          ) : null}

          {insights.data ? <ReviewInsightsCard insights={insights.data} /> : null}

          <ProductRail
            title="Often bought together"
            products={related.data?.boughtTogether ?? []}
          />
          <ProductRail title="Similar products" products={related.data?.similar ?? []} />
          <ProductRail title="Customers also viewed" products={related.data?.alsoViewed ?? []} />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  option: { borderWidth: 1, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 10 },
});
