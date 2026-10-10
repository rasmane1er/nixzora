import { multiBuyTerms } from '@nixzora/i18n';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { ProductGrid } from '@/components/ProductGrid';
import { Button, EmptyState, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { space } from '@/lib/theme';

/** Buy X, get Y (p10-27): the offer's products, to mix and match. */
export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT('multiBuy');
  const td = useT('deals');
  const f = useFormatters();
  const offer = useQuery({
    queryKey: ['multi-buy', id],
    queryFn: () => api.catalog.multiBuy(id),
    retry: false,
  });
  if (offer.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('navTitle') }} />
        <ActivityIndicator style={{ marginTop: space.xl }} />
      </Screen>
    );
  }
  const o = offer.data;
  if (!o) {
    // Ended (or never existed): links to it live on in carts.
    return (
      <Screen>
        <Stack.Screen options={{ title: t('navTitle') }} />
        <EmptyState title={t('ended')} />
        <Button title={td('title')} tone="ghost" onPress={() => router.replace('/deals')} />
      </Screen>
    );
  }
  const terms = multiBuyTerms(t, o);
  const vars = { group: o.buyQty + o.getQty, get: o.getQty, percent: o.percentOff };
  return (
    <>
      <Stack.Screen options={{ title: terms }} />
      <ProductGrid
        products={o.products}
        refreshing={offer.isRefetching}
        onRefresh={() => void offer.refetch()}
        header={
          <View style={{ gap: space.xs }}>
            <Text variant="title">{terms}</Text>
            <Text muted>
              {o.percentOff >= 100 ? t('lead_free', vars) : t('lead_percent', vars)}
            </Text>
            <Text variant="small" muted>
              {o.seller ? t('from', { store: o.seller.displayName }) : t('fromNixzora')}
              {o.endsAt ? ` · ${t('endsOn', { date: f.shortDate(o.endsAt) })}` : ''}
            </Text>
          </View>
        }
        empty={<EmptyState title={t('noProducts')} />}
      />
    </>
  );
}
