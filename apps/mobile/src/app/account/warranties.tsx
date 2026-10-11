import { errorMessage } from '@nixzora/api-client';
import { warrantyLabel } from '@nixzora/i18n';
import { type WarrantyView } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { Banner, Button, Card, EmptyState, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { fonts, space, usePalette } from '@/lib/theme';

const STATUS = {
  ACTIVE: ['statusActive', 'ok'],
  ENDING_SOON: ['statusEndingSoon', 'warn'],
  ENDED: ['statusEnded', 'neutral'],
} as const;

/** Warranty tracker (p10-33): what's still covered, until when, and who to contact. */
export default function WarrantiesScreen() {
  const t = useT('warranty');
  const items = useQuery({ queryKey: keys.warranties, queryFn: () => api.me.warranties() });

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
            <WarrantyCard key={item.orderItemId} item={item} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function WarrantyCard({ item }: { item: WarrantyView }) {
  const t = useT('warranty');
  const p = usePalette();
  const { shortDate } = useFormatters();
  const day = (iso: string) => shortDate(`${iso}T12:00:00Z`);
  const [statusKey, tone] = STATUS[item.status];
  const contact = () =>
    item.seller
      ? router.push({
          pathname: '/messages/new',
          params: {
            store: item.seller.handle,
            name: item.seller.displayName,
            order: item.orderNumber,
          },
        })
      : router.push({ pathname: '/help/chat', params: { order: item.orderNumber } });

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
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ alignSelf: 'flex-start' }}>
            <Pill label={t(statusKey)} tone={tone} />
          </View>
          <Text
            style={{ fontFamily: fonts.bodyBold }}
            numberOfLines={2}
            accessibilityRole={item.productSlug ? 'link' : undefined}
            onPress={item.productSlug ? () => router.push(`/p/${item.productSlug}`) : undefined}
          >
            {item.productTitle}
          </Text>
          <Text variant="small" muted>
            {warrantyLabel(t, item.months)} · {item.variantTitle}
          </Text>
          <Text variant="small" style={{ fontFamily: fonts.bodyMedium }}>
            {item.status === 'ENDED'
              ? t('endedOn', { date: day(item.until) })
              : t('coveredUntil', { date: day(item.until) })}
          </Text>
          <Text variant="small" muted>
            {t('since', { date: day(item.from), number: item.orderNumber.replace('-', '\u2011') })}
            {item.seller ? ` · ${t('soldBy', { store: item.seller.displayName })}` : ''}
          </Text>
        </View>
      </Row>
      <Row style={{ gap: space.sm }}>
        {item.status !== 'ENDED' ? (
          <Button
            small
            singleLine
            tone="secondary"
            title={item.seller ? t('contact') : t('contactNixzora')}
            onPress={contact}
            style={{ flex: 1 }}
          />
        ) : null}
        <Button
          small
          singleLine
          tone="ghost"
          title={t('viewOrder')}
          onPress={() => router.push(`/orders/${item.orderNumber}`)}
          style={{ flex: 1 }}
        />
      </Row>
    </Card>
  );
}
