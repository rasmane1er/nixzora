import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableLink } from '@/components/PressableLink';
import { errorMessage } from '@nixzora/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { OrderStatusPill } from '@/components/OrderStatusPill';
import { Banner, Button, Divider, EmptyState, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

export default function OrdersScreen() {
  const p = usePalette();
  const { status } = useSession();
  const orders = useQuery({
    queryKey: keys.orders,
    queryFn: () => api.orders.mine(),
    enabled: status === 'signedIn',
  });

  if (status !== 'signedIn') {
    return (
      <Screen>
        <EmptyState
          title="Sign in to see your orders"
          body="Bought as a guest? Open the link in your confirmation email on this phone."
          action={<Button title="Sign in" onPress={() => router.push('/sign-in')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} />
      }
    >
      {orders.error ? <Banner tone="error">{errorMessage(orders.error)}</Banner> : null}
      {orders.data && !orders.data.length ? (
        <EmptyState
          title="No orders yet"
          body="When you buy something it shows up here, with tracking."
          action={<Button title="Start shopping" onPress={() => router.navigate('/')} />}
        />
      ) : null}
      <View>
        {orders.data?.map((order, index) => (
          <View key={order.id}>
            {index ? <Divider /> : null}
            <PressableLink
              href={`/orders/${order.number}`}
              accessibilityRole="link"
              style={({ pressed }) => ({ paddingVertical: space.md, opacity: pressed ? 0.7 : 1 })}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ gap: 4, flex: 1 }}>
                  <Text variant="mono">{order.number}</Text>
                  <Text variant="small" muted>
                    {shortDate(order.placedAt ?? order.createdAt)} · {order.itemCount} item
                    {order.itemCount === 1 ? '' : 's'}
                  </Text>
                  <OrderStatusPill status={order.status} />
                </View>
                <Text style={{ fontFamily: fonts.displayMedium }}>
                  {money(order.totalCents, order.currency)}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={p.muted} />
              </Row>
            </PressableLink>
          </View>
        ))}
      </View>
    </Screen>
  );
}
