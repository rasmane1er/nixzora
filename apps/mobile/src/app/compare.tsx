import { errorMessage } from '@nixzora/api-client';
import { deliveryRange, specLabel } from '@nixzora/i18n';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from 'react-native';
import { Price } from '@/components/Price';
import { PressableLink } from '@/components/PressableLink';
import { Stars } from '@/components/Stars';
import { Banner, EmptyState, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { fonts, radius, space, usePalette } from '@/lib/theme';

const COL = 150;
const LABEL = 110;

/** Compare products side by side (p10-13): /compare?products=a,b,c. Scrolls sideways. */
export default function CompareScreen() {
  const p = usePalette();
  const t = useT('compare');
  const c = useT('common');
  const locale = useLocale();
  const { products: param } = useLocalSearchParams<{ products?: string }>();
  const [onlyDiff, setOnlyDiff] = useState(false);
  const slugs = (param ?? '').split(',').filter(Boolean).slice(0, 4);
  const view = useQuery({
    queryKey: ['compare', slugs.join(',')],
    queryFn: () => api.catalog.compare(slugs),
    enabled: slugs.length > 0,
  });

  if (view.isLoading) return <ActivityIndicator style={{ flex: 1, backgroundColor: p.bg }} />;
  const products = view.data?.products ?? [];
  if (products.length < 2) {
    return (
      <Screen>
        {view.error ? <Banner tone="error">{errorMessage(view.error)}</Banner> : null}
        <EmptyState title={t('title')} body={products.length ? t('needMore') : t('empty')} />
      </Screen>
    );
  }
  const differing = new Set(view.data!.differing);
  const specs = onlyDiff ? view.data!.differing : view.data!.specs;
  const value = (v: unknown) =>
    v === undefined || v === null
      ? t('none')
      : typeof v === 'boolean'
        ? v
          ? c('yes')
          : c('no')
        : String(v);
  const remove = (slug: string) =>
    router.setParams({
      products: products
        .filter((x) => x.slug !== slug)
        .map((x) => x.slug)
        .join(','),
    });

  const row = (label: string, cells: React.ReactNode[], highlight = false) => (
    <View
      key={label}
      style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: p.line,
        backgroundColor: highlight ? p.tile + '14' : undefined,
      }}
    >
      <View style={{ width: LABEL, padding: space.sm }}>
        <Text variant="small" muted>
          {label}
        </Text>
      </View>
      {cells.map((cell, i) => (
        <View key={i} style={{ width: COL, padding: space.sm }}>
          {cell}
        </View>
      ))}
    </View>
  );

  return (
    <Screen>
      <Text muted>{t('lead')}</Text>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text>{t('onlyDifferences')}</Text>
        <Switch
          value={onlyDiff}
          onValueChange={setOnlyDiff}
          accessibilityLabel={t('onlyDifferences')}
        />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {row(
            '',
            products.map((product) => (
              <View key={product.id} style={{ gap: space.xs }}>
                <PressableLink
                  href={`/p/${product.slug}`}
                  accessibilityRole="link"
                  style={{ gap: space.xs }}
                >
                  {product.image ? (
                    <Image
                      source={{ uri: product.image.url }}
                      style={{
                        width: COL - 16,
                        height: 100,
                        borderRadius: radius,
                        backgroundColor: p.card,
                      }}
                      contentFit="contain"
                    />
                  ) : null}
                  <Text variant="small" numberOfLines={3} style={{ fontFamily: fonts.bodyMedium }}>
                    {product.title}
                  </Text>
                </PressableLink>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => remove(product.slug)}
                  hitSlop={6}
                >
                  <Text variant="small" tone="signal">
                    {t('remove')}
                  </Text>
                </Pressable>
              </View>
            )),
          )}
          {row(
            t('price'),
            products.map((product) => (
              <Price
                key={product.id}
                cents={product.priceFromCents}
                compareAtCents={product.compareAtCents}
                currency={product.currency}
              />
            )),
          )}
          {row(
            t('rating'),
            products.map((product) =>
              product.rating?.average != null && product.rating.count ? (
                <Stars
                  key={product.id}
                  average={product.rating.average}
                  count={product.rating.count}
                />
              ) : (
                <Text key={product.id}>{t('none')}</Text>
              ),
            ),
          )}
          {row(
            t('delivery'),
            products.map((product) => (
              <Text key={product.id} variant="small">
                {product.delivery ? deliveryRange(product.delivery, locale) : t('none')}
              </Text>
            )),
          )}
          {row(
            t('stock'),
            products.map((product) => (
              <Text key={product.id} variant="small" tone={product.inStock ? 'ok' : 'error'}>
                {product.inStock ? t('inStock') : t('soldOut')}
              </Text>
            )),
          )}
          {row(
            t('soldBy'),
            products.map((product) => (
              <Text key={product.id} variant="small">
                {product.seller?.displayName ?? 'NIXZORA'}
              </Text>
            )),
          )}
          {specs.map((key) =>
            row(
              specLabel(key, locale),
              products.map((product) => (
                <Text key={product.id} variant="small">
                  {value(product.attributes[key])}
                </Text>
              )),
              differing.has(key),
            ),
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
