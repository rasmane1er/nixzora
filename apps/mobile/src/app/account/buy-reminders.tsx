import { errorMessage } from '@nixzora/api-client';
import { calendarDay } from '@nixzora/i18n';
import { type BuyReminderView } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { Banner, Button, Card, EmptyState, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { fonts, space, usePalette } from '@/lib/theme';

/** "Remind me to buy" (p10-36): the reminders a customer has set, soonest first. */
export default function BuyRemindersScreen() {
  const t = useT('buyReminders');
  const items = useQuery({ queryKey: keys.buyReminders, queryFn: () => api.me.buyReminders() });

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={items.isRefetching} onRefresh={() => void items.refetch()} />
      }
    >
      {items.error ? <Banner tone="error">{errorMessage(items.error)}</Banner> : null}
      {items.data && items.data.length === 0 ? (
        <EmptyState title={t('title')} body={t('empty')} />
      ) : null}
      {items.data?.length ? (
        <>
          <Text muted>{t('lead')}</Text>
          {items.data.map((item) => (
            <ReminderCard key={item.productId} item={item} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function ReminderCard({ item }: { item: BuyReminderView }) {
  const t = useT('buyReminders');
  const p = usePalette();
  const { money, locale } = useFormatters();
  const client = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => api.me.removeBuyReminder(item.productId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.buyReminders }),
  });
  const product = item.product;
  return (
    <Card>
      <Row style={{ gap: space.md, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: p.photo,
          }}
        >
          {product?.image ? (
            <Image
              source={{ uri: product.image.url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="small" style={{ fontFamily: fonts.bodyBold }}>
            {t('remindOn', { date: calendarDay(item.date, locale) })}
          </Text>
          {product ? (
            <Text
              numberOfLines={2}
              accessibilityRole="link"
              onPress={() => router.push(`/p/${product.slug}`)}
              style={{ fontFamily: fonts.bodyMedium }}
            >
              {product.title}
            </Text>
          ) : null}
          {product ? (
            <Text variant="small">
              <Text variant="small" style={{ fontFamily: fonts.bodyBold }}>
                {money(product.priceFromCents)}
              </Text>
              {product.priceFromCents !== item.priceCents ? (
                <Text variant="small" muted>
                  {' · '}
                  {t('priceWhenSet', { price: money(item.priceCents) })}
                </Text>
              ) : null}
            </Text>
          ) : null}
        </View>
      </Row>
      {cancel.error ? <Banner tone="error">{errorMessage(cancel.error)}</Banner> : null}
      <Button
        small
        singleLine
        tone="secondary"
        title={t('cancel')}
        loading={cancel.isPending}
        onPress={() => cancel.mutate()}
      />
    </Card>
  );
}
