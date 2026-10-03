import { errorMessage } from '@nixzora/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { PressableLink } from '@/components/PressableLink';
import { Banner, Button, Card, EmptyState, Pill, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { keys } from '@/lib/query';
import { space } from '@/lib/theme';

const STATUS: Record<string, { label: string; tone: 'neutral' | 'ok' | 'warn' | 'error' }> = {
  REQUESTED: { label: 'Requested', tone: 'warn' },
  APPROVED: { label: 'Approved: send it back', tone: 'warn' },
  REJECTED: { label: 'Not accepted', tone: 'error' },
  RECEIVED: { label: 'Received', tone: 'ok' },
  REFUNDED: { label: 'Refunded', tone: 'ok' },
};

/** Every return the customer asked for, with its progress and refund. */
export default function ReturnsScreen() {
  const returns = useQuery({ queryKey: keys.returns, queryFn: () => api.me.returns() });
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={returns.isRefetching}
          onRefresh={() => void returns.refetch()}
        />
      }
    >
      <Text muted>
        Most items can be returned within 30 days of delivery. Refunds go back to the card you paid
        with.
      </Text>
      {returns.error ? <Banner tone="error">{errorMessage(returns.error)}</Banner> : null}
      {returns.data && !returns.data.length ? (
        <EmptyState
          title="No returns"
          body="To return something, open the order and choose Return an item."
          action={
            <Button
              title="Your orders"
              tone="ghost"
              onPress={() => router.push('/orders?filter=delivered')}
            />
          }
        />
      ) : null}
      {returns.data?.map((r) => {
        const s = STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const };
        return (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Pill label={s.label} tone={s.tone} />
              {r.refundCents ? <Text>{money(r.refundCents)}</Text> : null}
            </View>
            <PressableLink href={`/orders/${r.orderNumber}`} accessibilityRole="link">
              <Text variant="small" muted>
                Order <Text variant="mono">{r.orderNumber}</Text> · requested{' '}
                {shortDate(r.createdAt)}
              </Text>
            </PressableLink>
            {r.items.map((item) => (
              <Text key={item.orderItemId}>
                {item.quantity} × {item.productTitle}
              </Text>
            ))}
            <Text variant="small" muted>
              Reason: {r.reason}
            </Text>
            {r.staffNote ? <Banner tone="info">From NIXZORA: {r.staffNote}</Banner> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
