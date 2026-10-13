import { InlineDeadline } from '@/components/Countdown';
import { errorMessage } from '@nixzora/api-client';
import { spendTiers } from '@nixzora/i18n';
import { type DealKind, type ProductCard as Card, spotlightDeal } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { OfferTag } from '@/components/MultiBuy';
import { ProductGrid } from '@/components/ProductGrid';
import { CouponShape, DealTile, QuadCard, SpotlightDeal } from '@/components/ShapeCards';
import { Chips } from '@/components/Chips';
import { Banner, EmptyState, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space } from '@/lib/theme';

/** Today's deals (p10-07): live deals ending soonest first, then what starts next. */
export default function DealsScreen() {
  const t = useT('deals');
  const tpl = useT('plus');
  const mb = useT('multiBuy');
  const sp = useT('spendSave');
  const tk = useT('cards');
  const { percent, dateTime, money, shortDate, departmentName } = useFormatters();
  const [kind, setKind] = useState<DealKind | 'ALL'>('ALL');
  const deals = useQuery({
    queryKey: ['deals', kind],
    queryFn: () => api.catalog.deals(kind === 'ALL' ? {} : { kind }),
    staleTime: 30_000,
  });
  const upcoming = deals.data?.upcoming ?? [];
  // Card shapes (ADR-0061): the deal ending soonest gets the spotlight, the rest are tiles.
  const live = deals.data?.live ?? [];
  const spotlight = spotlightDeal(live, deals.dataUpdatedAt);
  const tiles = live.filter((product) => product.id !== spotlight?.id);
  const byDepartment = [
    ...live
      .reduce((map, product) => {
        const entry = map.get(product.category.slug) ?? { first: product, count: 0 };
        entry.count += 1;
        return map.set(product.category.slug, entry);
      }, new Map<string, { first: Card; count: number }>())
      .values(),
  ].slice(0, 4);
  // Clip coupons (p10-18), as dashed coupon cards.
  const coupons = useQuery({
    queryKey: ['coupons'],
    queryFn: () => api.catalog.coupons(),
    staleTime: 60_000,
  });
  // Spend more, save more (p10-31): stores taking money off bigger orders.
  const spends = useQuery({
    queryKey: ['spend-offers'],
    queryFn: () => api.catalog.spendOffers(),
    staleTime: 60_000,
  });
  // Buy X, get Y (p10-27): live offers to mix and match.
  const offers = useQuery({
    queryKey: ['multi-buys'],
    queryFn: () => api.catalog.multiBuys(),
    staleTime: 60_000,
  });

  return (
    <ProductGrid
      products={tiles}
      renderCard={(product) => <DealTile product={product} />}
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
          {spotlight ? <SpotlightDeal product={spotlight} /> : null}
          {kind === 'ALL' && coupons.data?.coupons.length ? (
            <View style={{ gap: space.sm }}>
              <Text variant="heading">{tk('coupons')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -space.lg }}
                contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
              >
                {coupons.data.coupons.slice(0, 8).map((coupon) => (
                  <CouponShape key={coupon.id} coupon={coupon} width={290} />
                ))}
              </ScrollView>
            </View>
          ) : null}
          {byDepartment.length >= 2 ? (
            <QuadCard
              title={tk('dealsByDepartment')}
              items={byDepartment.map(({ first, count }) => ({
                href: `/c/${first.category.slug}`,
                product: first,
                label: `${departmentName(first.category.slug, first.category.name)} · ${tk('dealCount', { count })}`,
              }))}
            />
          ) : null}
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
          {kind === 'ALL' && spends.data?.length ? (
            <View style={{ gap: space.sm }}>
              <Text variant="heading">{sp('title')}</Text>
              <Text variant="small" muted>
                {sp('dealsLead')}
              </Text>
              {spends.data.map((o) => (
                <Pressable
                  key={o.id}
                  accessibilityRole="link"
                  disabled={!o.seller}
                  onPress={() => o.seller && router.push(`/s/${o.seller.handle}`)}
                  style={{ gap: 2 }}
                >
                  <Text variant="small" style={{ fontFamily: fonts.bodyBold }}>
                    {spendTiers(sp, o.tiers, money)}
                  </Text>
                  <Text variant="small" muted>
                    {o.seller ? sp('onStore', { store: o.seller.displayName }) : sp('onNixzora')}
                    {o.endsAt ? (
                      <>
                        {' · '}
                        <InlineDeadline
                          until={o.endsAt}
                          later={sp('endsOn', { date: shortDate(o.endsAt) })}
                        />
                      </>
                    ) : null}
                    {o.seller ? ' ›' : ''}
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
      empty={deals.isLoading || live.length ? undefined : <EmptyState title={t('none')} />}
    />
  );
}
