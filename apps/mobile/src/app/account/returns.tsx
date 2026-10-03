import { errorMessage } from '@nixzora/api-client';
import { type MessageKey, rich } from '@nixzora/i18n';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { PressableLink } from '@/components/PressableLink';
import { Banner, Button, Card, EmptyState, Pill, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormat, useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { space } from '@/lib/theme';

const STATUS: Record<
  string,
  { label: MessageKey<'appAccount'>; tone: 'neutral' | 'ok' | 'warn' | 'error' }
> = {
  REQUESTED: { label: 'returnRequested', tone: 'warn' },
  APPROVED: { label: 'returnApproved', tone: 'warn' },
  REJECTED: { label: 'returnRejected', tone: 'error' },
  RECEIVED: { label: 'returnReceived', tone: 'ok' },
  REFUNDED: { label: 'returnRefunded', tone: 'ok' },
};

/** Every return the customer asked for, with its progress and refund. */
export default function ReturnsScreen() {
  const returns = useQuery({ queryKey: keys.returns, queryFn: () => api.me.returns() });
  const t = useT('appAccount');
  const f = useFormat();
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={returns.isRefetching}
          onRefresh={() => void returns.refetch()}
        />
      }
    >
      <Text muted>{t('returnsIntro')}</Text>
      {returns.error ? <Banner tone="error">{errorMessage(returns.error)}</Banner> : null}
      {returns.data && !returns.data.length ? (
        <EmptyState
          title={t('returnsEmptyTitle')}
          body={t('returnsEmptyBody')}
          action={
            <Button
              title={t('returnsYourOrders')}
              tone="ghost"
              onPress={() => router.push('/orders?filter=delivered')}
            />
          }
        />
      ) : null}
      {returns.data?.map((r) => {
        const status = STATUS[r.status];
        const s = status
          ? { label: t(status.label), tone: status.tone }
          : { label: r.status, tone: 'neutral' as const };
        return (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Pill label={s.label} tone={s.tone} />
              {r.refundCents ? <Text>{f.money(r.refundCents)}</Text> : null}
            </View>
            <PressableLink href={`/orders/${r.orderNumber}`} accessibilityRole="link">
              <Text variant="small" muted>
                {rich(t('returnsOrderLine', { number: r.orderNumber, date: f.date(r.createdAt) }), {
                  num: (chunk) => (
                    <Text key="num" variant="mono">
                      {chunk}
                    </Text>
                  ),
                })}
              </Text>
            </PressableLink>
            {r.items.map((item) => (
              <Text key={item.orderItemId}>
                {item.quantity} × {item.productTitle}
              </Text>
            ))}
            <Text variant="small" muted>
              {t('returnsReason', { reason: r.reason })}
            </Text>
            {r.staffNote ? (
              <Banner tone="info">{t('returnsStaffNote', { note: r.staffNote })}</Banner>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
