import type { BundleView } from '@nixzora/validation';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useCartMutation } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';
import { Banner, Button, Card, Text } from './ui';

const BUNDLE_TEAL = '#0F766E';

/**
 * Bundle & save (p10-16): the products bundled with this one, the price together and the saving,
 * and one button that adds the set. Same as the website's.
 */
export function BundleOfferCard({ bundle, currentId }: { bundle: BundleView; currentId: string }) {
  const t = useT('bundles');
  const p = usePalette();
  const { money, percent } = useFormatters();
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});
  const add = useCartMutation(() => api.cart.addBundle(bundle.id));
  const products = [
    ...bundle.products.filter((x) => x.id === currentId),
    ...bundle.products.filter((x) => x.id !== currentId),
  ];
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <View style={{ backgroundColor: BUNDLE_TEAL, borderRadius: 999, paddingHorizontal: 8 }}>
          <Text variant="small" style={{ color: '#FFFFFF', fontFamily: fonts.bodyBold }}>
            {t('title')}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.bodyBold, color: p.fg, flexShrink: 1 }}>
          {bundle.title}
        </Text>
      </View>
      {products.map((x, i) => (
        <View key={x.id} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Text muted style={{ width: 14, textAlign: 'center' }}>
            {i ? '+' : ''}
          </Text>
          {x.image ? (
            <Image
              source={{ uri: x.image.url }}
              style={{ width: 48, height: 36, borderRadius: 6 }}
              contentFit="cover"
            />
          ) : null}
          <Text
            variant="small"
            numberOfLines={2}
            style={{ flex: 1 }}
            onPress={x.id === currentId ? undefined : () => router.push(`/p/${x.slug}`)}
          >
            {x.id === currentId ? t('thisItem') : x.title} · {money(x.priceFromCents)}
          </Text>
        </View>
      ))}
      <View style={{ gap: 2 }}>
        <Text>
          {t('total')}:{' '}
          <Text style={{ fontFamily: fonts.bodyBold }}>{money(bundle.bundlePriceCents)}</Text>{' '}
          <Text muted style={{ textDecorationLine: 'line-through' }}>
            {money(bundle.priceCents)}
          </Text>
        </Text>
        <Text variant="small" style={{ color: BUNDLE_TEAL, fontFamily: fonts.bodyBold }}>
          {t('save', {
            amount: money(bundle.priceCents - bundle.bundlePriceCents),
            percent: percent(bundle.percentOff / 100),
          })}
        </Text>
      </View>
      {bundle.available ? (
        <Button
          title={t('addBundle')}
          loading={add.isPending}
          onPress={() =>
            add.mutate(undefined, {
              onSuccess: () => setMessage({ ok: t('added') }),
              onError: (error) => setMessage({ error: (error as Error).message }),
            })
          }
        />
      ) : (
        <Text muted variant="small">
          {t('unavailable')}
        </Text>
      )}
      {message.error ? <Banner tone="error">{message.error}</Banner> : null}
      {message.ok ? <Banner tone="ok">{message.ok}</Banner> : null}
    </Card>
  );
}
