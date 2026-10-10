import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import type { OrderView } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, View } from 'react-native';
import { ExpectedDelivery, TrackingScans } from '@/components/Delivery';
import { OrderStatusPill } from '@/components/OrderStatusPill';
import { RateSeller } from '@/components/RateSeller';
import { Totals } from '@/components/Totals';
import { PressableLink } from '@/components/PressableLink';
import { Banner, Button, Card, Divider, EmptyState, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { enablePush, type PushStatus } from '@/lib/push';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { brand, fonts, space, usePalette } from '@/lib/theme';

/** The usual path of an order, so the timeline can show what comes next. */
const PATH = ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED'] as const;

function Timeline({ order }: { order: OrderView }) {
  const p = usePalette();
  const { dateTime, statusLabel } = useFormatters();
  const reached = new Map(order.timeline.map((step) => [step.status, step.at]));
  const steps: string[] =
    order.status === 'CANCELLED' || order.status.endsWith('REFUNDED')
      ? order.timeline.map((step) => step.status)
      : [...PATH];
  return (
    <View style={{ gap: 0 }}>
      {steps.map((status, index) => {
        const at = reached.get(status as OrderView['status']);
        const done = !!at;
        return (
          <Row key={status} style={{ alignItems: 'flex-start', gap: space.md }}>
            <View style={{ alignItems: 'center', width: 16 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  marginTop: 5,
                  backgroundColor: done ? brand.signal : 'transparent',
                  borderWidth: 2,
                  borderColor: done ? brand.signal : p.line,
                }}
              />
              {index < steps.length - 1 ? (
                <View
                  style={{ width: 2, height: 28, backgroundColor: done ? brand.signal : p.line }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: done ? fonts.bodyMedium : fonts.body }} muted={!done}>
                {statusLabel(status)}
              </Text>
              {at ? (
                <Text variant="small" muted>
                  {dateTime(at)}
                </Text>
              ) : null}
            </View>
          </Row>
        );
      })}
    </View>
  );
}

const SHIPMENT_LABEL = {
  PROCESSING: 'shipment_PROCESSING',
  SHIPPED: 'shipment_SHIPPED',
  DELIVERED: 'shipment_DELIVERED',
  CANCELLED: 'shipment_CANCELLED',
} as const;

export default function OrderScreen() {
  const { number, token, placed } = useLocalSearchParams<{
    number: string;
    token?: string;
    placed?: string;
  }>();
  const { status } = useSession();
  const t = useT('appShop');
  const to = useT('order');
  const tc = useT('common');
  const { money, shortDate } = useFormatters();
  const [push, setPush] = useState<PushStatus | null>(null);
  const w = useT('wallet');
  const g = useT('gifts');
  const tpl = useT('plus');
  const ti = useT('inbox');
  const client = useQueryClient();
  // Changed your mind (p10-09): cancel within 30 minutes, before anything is packed.
  const cancel = useMutation({
    mutationFn: () => api.orders.cancel(number, token),
    onSuccess: (view) => {
      client.setQueryData(keys.order(number), view);
      void client.invalidateQueries({ queryKey: keys.orders });
    },
  });
  const order = useQuery({
    queryKey: keys.order(number),
    queryFn: () => api.orders.get(number, token),
    enabled: !!token || status === 'signedIn',
    // Right after paying, the payment webhook may still be on its way: check again shortly.
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING_PAYMENT' && query.state.dataUpdateCount < 15
        ? 2000
        : false,
  });

  if (!token && status !== 'signedIn') {
    return (
      <Screen>
        <EmptyState
          title={t('signInForOrder')}
          action={<Button title={tc('signIn')} onPress={() => router.push('/sign-in')} />}
        />
      </Screen>
    );
  }
  if (order.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!order.data) {
    return (
      <Screen>
        <EmptyState
          title={t('couldNotOpenOrder')}
          body={order.error ? errorMessage(order.error) : undefined}
        />
      </Screen>
    );
  }

  const o = order.data;
  const a = o.shippingAddress;
  const totals = {
    currency: o.currency,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    shippingCents: o.shippingCents,
    taxCents: o.taxCents,
    totalCents: o.totalCents,
    freeShippingRemainingCents: 0,
  };

  return (
    <>
      <Stack.Screen options={{ title: o.number }} />
      <Screen
        refreshControl={
          <RefreshControl refreshing={order.isRefetching} onRefresh={() => void order.refetch()} />
        }
      >
        {placed ? (
          <Banner tone="ok">{t('orderPlaced', { number: o.number, email: o.email })}</Banner>
        ) : null}
        {cancel.isSuccess ? <Banner tone="ok">{w('cancelled')}</Banner> : null}
        {cancel.error ? <Banner tone="error">{errorMessage(cancel.error)}</Banner> : null}
        {o.cancellableUntil ? (
          <Card>
            <Text>
              {w('cancelUntil', {
                time: new Date(o.cancellableUntil).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                }),
              })}
            </Text>
            <Button
              title={w('cancelOrder')}
              tone="ghost"
              loading={cancel.isPending}
              onPress={() =>
                Alert.alert(w('cancelOrder'), w('cancelConfirm'), [
                  { text: w('keepOrder'), style: 'cancel' },
                  { text: w('cancelOrder'), style: 'destructive', onPress: () => cancel.mutate() },
                ])
              }
            />
          </Card>
        ) : null}
        {placed && status === 'signedIn' && push !== 'on' && push !== 'unsupported' ? (
          <Card>
            <Text variant="heading">{t('knowWhenShips')}</Text>
            <Text muted>{t('notifyBody')}</Text>
            {push === 'blocked' ? (
              <Text variant="small" tone="error">
                {t('notificationsOff')}
              </Text>
            ) : (
              <Button
                title={t('turnOnUpdates')}
                tone="secondary"
                onPress={() =>
                  void enablePush(true)
                    .then(setPush)
                    .catch(() => setPush('off'))
                }
              />
            )}
          </Card>
        ) : null}

        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ gap: 4 }}>
            <Text variant="label" muted>
              {t('placedOn', { date: shortDate(o.placedAt ?? o.createdAt) })}
            </Text>
            <OrderStatusPill status={o.status} />
          </View>
          <Text variant="title">{money(o.totalCents, o.currency)}</Text>
        </Row>

        {o.status === 'PENDING_PAYMENT' ? (
          <Banner tone="warn">{t('confirmingPayment')}</Banner>
        ) : null}

        {o.kind === 'PLUS' ? null : (
          <Card>
            <Timeline order={o} />
            {!o.shipments.length ? <ExpectedDelivery window={o.estimatedDelivery} /> : null}
            {o.shipments.length ? (
              // Marketplace order: one parcel for NIXZORA's items and one per seller.
              o.shipments.map((part) => (
                <View
                  key={part.seller?.handle ?? 'nixzora'}
                  style={{ gap: space.xs, marginTop: space.sm }}
                >
                  <Divider />
                  <Text style={{ fontFamily: fonts.bodyMedium }}>
                    {t('shipmentFrom', {
                      name: part.seller?.displayName ?? 'NIXZORA',
                      status: t(SHIPMENT_LABEL[part.status]),
                    })}
                  </Text>
                  <Text variant="small" muted>
                    {o.items
                      .filter((item) => part.itemIds.includes(item.id))
                      .map((item) => `${item.quantity} × ${item.productTitle}`)
                      .join(', ')}
                  </Text>
                  {part.tracking ? (
                    <Text variant="small" muted>
                      {part.tracking.carrier} · <Text variant="mono">{part.tracking.number}</Text>
                    </Text>
                  ) : null}
                  {part.status !== 'DELIVERED' ? (
                    <ExpectedDelivery window={part.estimatedDelivery} />
                  ) : null}
                  {part.tracking ? <TrackingScans events={part.events} /> : null}
                  {part.tracking?.url ? (
                    <Button
                      title={to('trackPackage')}
                      tone="ghost"
                      icon={<Ionicons name="navigate-outline" size={18} color={brand.signal} />}
                      onPress={() => void WebBrowser.openBrowserAsync(part.tracking!.url!)}
                    />
                  ) : null}
                  {part.seller && status === 'signedIn' ? (
                    <Button
                      title={ti('contactStore', { store: part.seller.displayName })}
                      tone="ghost"
                      onPress={() =>
                        router.push({
                          pathname: '/messages/new',
                          params: {
                            store: part.seller!.handle,
                            name: part.seller!.displayName,
                            order: o.number,
                          },
                        })
                      }
                    />
                  ) : null}
                  {part.seller && part.ratableUntil ? (
                    <RateSeller number={o.number} token={token} shipment={part} />
                  ) : part.rating ? (
                    <Text variant="small" muted>
                      {to('ratedSeller', { value: part.rating.value })}
                    </Text>
                  ) : null}
                </View>
              ))
            ) : o.tracking ? (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <Divider />
                <Text variant="small" muted>
                  {o.tracking.carrier} · <Text variant="mono">{o.tracking.number}</Text>
                </Text>
                <TrackingScans events={o.trackingEvents} />
                {o.tracking.url ? (
                  <Button
                    title={to('trackPackage')}
                    tone="ghost"
                    icon={<Ionicons name="navigate-outline" size={18} color={brand.signal} />}
                    onPress={() => void WebBrowser.openBrowserAsync(o.tracking!.url!)}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        )}

        <Card>
          <Text variant="heading">{to('items')}</Text>
          {o.items.map((item) => (
            <Row
              key={item.id}
              style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text>{item.productTitle}</Text>
                <Text variant="small" muted>
                  {t('lineQuantity', { variant: item.variantTitle, quantity: item.quantity })}
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.bodyMedium }}>
                {money(item.totalCents, o.currency)}
              </Text>
            </Row>
          ))}
          <Divider />
          <Totals totals={totals} />
          {o.giftBalanceCents ? (
            <Text variant="small" muted>
              {g('balanceLine')}: −{money(o.giftBalanceCents, o.currency)}
            </Text>
          ) : null}
          {o.refundedCents ? (
            <Text variant="small" tone="ok">
              {t('refundedAmount', { amount: money(o.refundedCents, o.currency) })}
            </Text>
          ) : null}
        </Card>

        {o.kind === 'GIFT_CARD' ? (
          <Card>
            {(o.giftCards ?? []).map((card) => (
              <Text key={card.id}>
                {money(card.amountCents, o.currency)} ·{' '}
                {card.status === 'PENDING'
                  ? g('pendingSend', { name: card.recipientName, email: card.recipientEmail })
                  : card.status === 'VOID'
                    ? g('voided', { name: card.recipientName })
                    : g('sentTo', { name: card.recipientName, email: card.recipientEmail })}
              </Text>
            ))}
          </Card>
        ) : o.kind === 'PLUS' ? (
          <Card>
            <Text variant="heading">{tpl('orderTitle')}</Text>
            <Text muted>{tpl('orderNote')}</Text>
            <PressableLink href="/plus">
              <Text tone="signal">{tpl('manage')}</Text>
            </PressableLink>
          </Card>
        ) : (
          <Card>
            <Text variant="heading">{to('shippingTo')}</Text>
            <Text>
              {a.fullName}
              {'\n'}
              {a.line1}
              {a.line2 ? `\n${a.line2}` : ''}
              {'\n'}
              {a.city}, {a.region} {a.postalCode}
            </Text>
          </Card>
        )}

        {o.returnableUntil ? (
          <Button
            title={t('returnItemUntil', { date: shortDate(o.returnableUntil) })}
            tone="ghost"
            onPress={() =>
              router.push({
                pathname: '/return/[number]',
                params: token ? { number: o.number, token } : { number: o.number },
              })
            }
          />
        ) : null}
      </Screen>
    </>
  );
}
