import type { FollowingFeed } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, RefreshControl, View } from 'react-native';
import { ProductRail } from '@/components/ProductRail';
import { Card, EmptyState, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';

/** Following (p10-24): deals and new listings from the stores you follow, and the stores. */
export default function FollowingScreen() {
  const t = useT('follows');
  const p = usePalette();
  const feed = useQuery<FollowingFeed>({
    queryKey: ['following'],
    queryFn: () => api.account.following(),
  });
  const data = feed.data;
  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} />
      }
    >
      <Text muted>{t('lead')}</Text>
      {data && !data.stores.length ? <EmptyState title={t('none')} /> : null}
      {data?.stores.length ? (
        <>
          {/* An empty rail draws nothing, so its title and a note stand in for it. */}
          {data.deals.length ? (
            <ProductRail title={t('dealsTitle')} products={data.deals} inset={0} />
          ) : (
            <View style={{ gap: space.xs }}>
              <Text variant="heading">{t('dealsTitle')}</Text>
              <Text muted>{t('noDeals')}</Text>
            </View>
          )}
          {data.newArrivals.length ? (
            <ProductRail title={t('newTitle')} products={data.newArrivals} inset={0} />
          ) : (
            <View style={{ gap: space.xs }}>
              <Text variant="heading">{t('newTitle')}</Text>
              <Text muted>{t('noNew')}</Text>
            </View>
          )}
          <Text variant="heading">{t('storesTitle')}</Text>
          <Card style={{ paddingVertical: space.xs }}>
            {data.stores.map((store, i) => (
              <Pressable
                key={store.handle}
                accessibilityRole="link"
                onPress={() => router.push(`/s/${store.handle}`)}
                style={{
                  paddingVertical: space.md,
                  borderTopWidth: i ? 1 : 0,
                  borderColor: p.line,
                }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }}>
                      {store.displayName}
                    </Text>
                    {store.newCount ? (
                      <Text variant="small" muted>
                        {t('newCount', { count: store.newCount })}
                      </Text>
                    ) : null}
                  </View>
                  <Text tone="signal">{t('visit')} ›</Text>
                </Row>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
