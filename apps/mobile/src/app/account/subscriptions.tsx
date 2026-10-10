import { errorMessage } from '@nixzora/api-client';
import { cardBrand } from '@nixzora/i18n';
import {
  SUBSCRIBE_PERCENT,
  SUBSCRIPTION_INTERVALS,
  type SubscriptionUpdate,
  type SubscriptionView,
} from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Alert, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { PressableLink } from '@/components/PressableLink';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Banner, Button, Card, EmptyState, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, radius, space } from '@/lib/theme';

const subKeys = { all: ['subscriptions'] as const };

/** Subscribe & Save (p10-11): what is coming, and how to change it. */
export default function SubscriptionsScreen() {
  const t = useT('subscribe');
  const w = useT('wallet');
  const tc = useT('common');
  const { money, shortDate, percent } = useFormatters();
  const client = useQueryClient();
  const subs = useQuery({ queryKey: subKeys.all, queryFn: () => api.account.subscriptions() });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: SubscriptionUpdate }) =>
      api.account.updateSubscription(id, body),
    onSuccess: (view) =>
      client.setQueryData<SubscriptionView[]>(subKeys.all, (old) =>
        (old ?? []).map((s) => (s.id === view.id ? view : s)),
      ),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.account.cancelSubscription(id),
    onSuccess: (_, id) =>
      client.setQueryData<SubscriptionView[]>(subKeys.all, (old) =>
        (old ?? []).filter((s) => s.id !== id),
      ),
  });
  const problem = subs.error ?? update.error ?? cancel.error;

  if (subs.data && !subs.data.length) {
    return (
      <Screen>
        <EmptyState
          title={t('title')}
          body={`${t('lead', { percent: percent(SUBSCRIBE_PERCENT / 100) })}\n\n${t('none')}`}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text muted>{t('lead', { percent: percent(SUBSCRIBE_PERCENT / 100) })}</Text>
      {problem ? <Banner tone="error">{errorMessage(problem)}</Banner> : null}
      {(subs.data ?? []).map((sub) => (
        <Card key={sub.id} style={{ gap: space.sm }}>
          <PressableLink
            href={`/p/${sub.product.slug}`}
            accessibilityRole="link"
            style={{ flexDirection: 'row', gap: space.md }}
          >
            {sub.product.imageUrl ? (
              <Image
                source={{ uri: sub.product.imageUrl }}
                style={{ width: 64, height: 64, borderRadius: radius }}
                contentFit="cover"
              />
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bodyMedium }} numberOfLines={2}>
                {sub.product.title}
              </Text>
              <Text variant="small" muted>
                {sub.variantTitle} · {money(sub.unitPriceCents)}
              </Text>
              {sub.status === 'PAUSED' ? (
                <Pill label={t('paused')} tone="warn" />
              ) : sub.nextOrderAt ? (
                <Text variant="small">{t('next', { date: shortDate(sub.nextOrderAt) })}</Text>
              ) : null}
            </View>
          </PressableLink>
          <Text variant="small" muted>
            {sub.card
              ? t('chargedTo', {
                  card: w('cardLabel', { brand: cardBrand(sub.card.brand), last4: sub.card.last4 }),
                  address: sub.shipTo,
                })
              : t('noCard')}
          </Text>
          {sub.failures ? <Banner tone="error">{t('failed')}</Banner> : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small">{t('quantity')}</Text>
            <QuantityStepper
              value={sub.quantity}
              max={10}
              onChange={(next) =>
                update.mutate({ id: sub.id, body: { quantity: Math.max(1, next) } })
              }
            />
          </Row>
          <Text variant="small">{t('every')}</Text>
          <Chips<string>
            value={String(sub.intervalDays)}
            onChange={(days) =>
              update.mutate({
                id: sub.id,
                body: { intervalDays: Number(days) as 14 | 30 | 60 | 90 },
              })
            }
            options={SUBSCRIPTION_INTERVALS.map((days) => ({
              value: String(days),
              label: t(`interval_${days}`),
            }))}
          />
          <Row style={{ gap: space.sm, flexWrap: 'wrap' }}>
            {sub.status === 'ACTIVE' ? (
              <>
                <Button
                  title={t('skip')}
                  tone="secondary"
                  onPress={() => update.mutate({ id: sub.id, body: { skipNext: true } })}
                />
                <Button
                  title={t('pause')}
                  tone="ghost"
                  onPress={() => update.mutate({ id: sub.id, body: { status: 'PAUSED' } })}
                />
              </>
            ) : (
              <Button
                title={t('resume')}
                onPress={() => update.mutate({ id: sub.id, body: { status: 'ACTIVE' } })}
              />
            )}
          </Row>
          <Button
            title={t('cancel')}
            tone="danger"
            onPress={() =>
              Alert.alert(t('cancel'), sub.product.title, [
                { text: tc('cancel'), style: 'cancel' },
                { text: t('cancel'), style: 'destructive', onPress: () => cancel.mutate(sub.id) },
              ])
            }
          />
        </Card>
      ))}
    </Screen>
  );
}
