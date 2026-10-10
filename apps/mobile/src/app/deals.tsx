import { errorMessage } from '@nixzora/api-client';
import type { DealKind } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { OfferTag } from '@/components/MultiBuy';
import { ProductGrid } from '@/components/ProductGrid';
import { Chips } from '@/components/Chips';
import { Banner, EmptyState, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { space } from '@/lib/theme';

/** Today's deals (p10-07): live deals ending soonest first, then what starts next. */
export default function DealsScreen() {
  const t = useT('deals');
  const tpl = useT('plus');
  const mb = useT('multiBuy');
  const { percent, dateTime } = useFormatters();
  const [kind, setKind] = useState<DealKind | 'ALL'>('ALL');
  const deals = useQuery({
    queryKey: ['deals', kind],
    queryFn: () => api.catalog.deals(kind === 'ALL' ? {} : { kind }),
    staleTime: 30_000,
  });
  const upcoming = deals.data?.upcoming ?? [];
  // Buy X, get Y (p10-27): live offers to mix and match.
  const offers = useQuery({
    queryKey: ['multi-buys'],
    queryFn: () => api.catalog.multiBuys(),
    staleTime: 60_000,
  });

  return (
    <ProductGrid
      products={deals.data?.live ?? []}
      refreshing={deals.isRefetching}
      onRefresh={() => void deals.refetch()}
      header={
        <View style={{ gap: space.md }}>
          <Text muted>{t('lead')}</Text>
          <Chips<DealKind | 'ALL'>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'ALL', label: t('filterAll') },
              { value: 'LIGHTNING', label: t('filterLightning') },
              { value: 'DAY', label: t('filterDay') },
            ]}
          />
          {deals.error ? <Banner tone="error">{errorMessage(deals.error)}</Banner> : null}
          {kind === 'ALL' && offers.data?.length ? (
            <View style={{ gap: space.sm }}>
              <Text variant="heading">{mb('navTitle')}</Text>
              {offers.data.map((o) => (
                <Pressable
                  key={o.id}
                  accessibilityRole="link"
                  onPress={() => router.push(`/offers/${o.id}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
                >
                  <OfferTag offer={o} />
                  <Text variant="small" muted style={{ flexShrink: 1 }}>
                    {o.seller ? mb('from', { store: o.seller.displayName }) : mb('fromNixzora')} ·{' '}
                    {mb('productCount', { count: o.products.length })} ›
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      }
      footer={
        upcoming.length ? (
          <View style={{ gap: space.sm, paddingTop: space.lg }}>
            <Text variant="heading">{t('upcomingTitle')}</Text>
            {upcoming.map((u) => (
              <Text key={u.product.id} variant="small">
                {u.product.title} · {t(u.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')} ·{' '}
                {t('percentOff', { percent: percent(u.percentOff / 100) })} ·{' '}
                {t('startsAt', { time: dateTime(u.startsAt) })}
                {u.earlyAccess ? ` · ${tpl('earlyAccessNow')}` : ''}
              </Text>
            ))}
          </View>
        ) : undefined
      }
      empty={deals.isLoading ? undefined : <EmptyState title={t('none')} />}
    />
  );
}
