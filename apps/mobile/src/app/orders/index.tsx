import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import type { AccountOrder, OrderFilter } from '@nixzora/validation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { OrderStatusPill } from '@/components/OrderStatusPill';
import { PressableLink } from '@/components/PressableLink';
import { Banner, Button, Card, EmptyState, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useCartMutation } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { READABLE_WIDTH } from '@/lib/layout';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';

const FILTERS = [
  { value: 'all', label: 'filterAll' },
  { value: 'open', label: 'filterOpen' },
  { value: 'delivered', label: 'filterDelivered' },
  { value: 'returns', label: 'filterReturns' },
  { value: 'cancelled', label: 'filterCancelled' },
] as const satisfies readonly { value: OrderFilter; label: string }[];

function BuyAgainButton({ variantId }: { variantId: string }) {
  const t = useT('appShop');
  const add = useCartMutation(() => api.cart.add(variantId, 1));
  return (
    <Button
      title={add.isSuccess ? t('inYourCart') : t('buyItAgain')}
      tone="secondary"
      loading={add.isPending}
      disabled={add.isSuccess}
      onPress={() => add.mutate(undefined)}
      style={{ alignSelf: 'flex-start', minHeight: 36, paddingVertical: 6 }}
    />
  );
}

/** One order: when, total and status, each item with "Buy it again" and "Write a review". */
function OrderCard({ order }: { order: AccountOrder }) {
  const p = usePalette();
  const t = useT('appShop');
  const { money, shortDate } = useFormatters();
  return (
    <Card style={{ gap: space.md }}>
      <PressableLink href={`/orders/${order.number}`} accessibilityRole="link">
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 4, flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyMedium }}>
              {order.status === 'DELIVERED' && order.deliveredAt
                ? t('deliveredOn', { date: shortDate(order.deliveredAt) })
                : t('orderedOn', { date: shortDate(order.placedAt ?? order.createdAt) })}
            </Text>
            <Text variant="small" muted>
              <Text variant="mono">{order.number}</Text> · {money(order.totalCents, order.currency)}
            </Text>
            <OrderStatusPill status={order.status} />
          </View>
          <Ionicons name="chevron-forward" size={18} color={p.muted} />
        </Row>
      </PressableLink>
      {order.lines.map((line) => (
        <Row key={line.orderItemId} style={{ alignItems: 'flex-start' }}>
          <Image
            source={{ uri: line.imageUrl ?? undefined }}
            style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: p.bg }}
            contentFit="cover"
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={2}>{line.productTitle}</Text>
            <Text variant="small" muted>
              {t('lineQuantity', { variant: line.variantTitle, quantity: line.quantity })}
            </Text>
            <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
              {line.canBuyAgain && line.variantId ? (
                <BuyAgainButton variantId={line.variantId} />
              ) : null}
              {line.canReview && line.productSlug ? (
                <Button
                  title={t('writeReview')}
                  tone="ghost"
                  onPress={() => router.push(`/p/${line.productSlug}`)}
                  style={{ alignSelf: 'flex-start', minHeight: 36, paddingVertical: 6 }}
                />
              ) : null}
            </Row>
          </View>
        </Row>
      ))}
      {order.returnableUntil ? (
        <Text variant="small" muted>
          {t('returnsOpenUntil', { date: shortDate(order.returnableUntil) })}
          {order.openReturns ? t('returnsInProgress', { count: order.openReturns }) : ''}
        </Text>
      ) : null}
    </Card>
  );
}

export default function OrdersScreen() {
  const p = usePalette();
  const t = useT('appShop');
  const tc = useT('common');
  const { status } = useSession();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<OrderFilter>(
    FILTERS.some((f) => f.value === params.filter) ? (params.filter as OrderFilter) : 'all',
  );
  const orders = useInfiniteQuery({
    queryKey: keys.orderHistory(filter),
    queryFn: ({ pageParam }) => api.me.orderHistory({ filter, page: pageParam, pageSize: 10 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: status === 'signedIn',
  });

  if (status !== 'signedIn') {
    return (
      <Screen>
        <EmptyState
          title={t('signInForOrders')}
          body={t('guestOrdersHint')}
          action={<Button title={tc('signIn')} onPress={() => router.push('/sign-in')} />}
        />
      </Screen>
    );
  }

  const items = orders.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <FlatList
      data={items}
      keyExtractor={(order) => order.id}
      style={{ backgroundColor: p.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: space.lg,
        gap: space.md,
        width: '100%',
        maxWidth: READABLE_WIDTH,
        alignSelf: 'center',
      }}
      refreshControl={
        <RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} />
      }
      ListHeaderComponent={
        <View style={{ gap: space.md }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm }}
          >
            {FILTERS.map((f) => {
              const active = f.value === filter;
              return (
                <Pressable
                  key={f.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(f.value)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: radius * 2,
                    borderWidth: 1,
                    borderColor: active ? p.fg : p.line,
                    backgroundColor: active ? p.fg : 'transparent',
                  }}
                >
                  <Text
                    variant="small"
                    style={{ color: active ? p.bg : p.fg, fontFamily: fonts.bodyMedium }}
                  >
                    {t(f.label)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {orders.error ? <Banner tone="error">{errorMessage(orders.error)}</Banner> : null}
          {orders.isLoading ? <ActivityIndicator /> : null}
        </View>
      }
      ListEmptyComponent={
        orders.isLoading ? null : (
          <EmptyState
            title={filter === 'all' ? t('noOrdersYet') : t('nothingHere')}
            body={filter === 'all' ? t('noOrdersBody') : t('noOrdersMatch')}
            action={
              filter === 'all' ? (
                <Button title={t('startShopping')} onPress={() => router.navigate('/')} />
              ) : (
                <Button title={t('showAllOrders')} tone="ghost" onPress={() => setFilter('all')} />
              )
            }
          />
        )
      }
      renderItem={({ item }) => <OrderCard order={item} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (orders.hasNextPage && !orders.isFetchingNextPage) void orders.fetchNextPage();
      }}
      ListFooterComponent={
        orders.isFetchingNextPage ? <ActivityIndicator color={brand.signal} /> : null
      }
    />
  );
}
