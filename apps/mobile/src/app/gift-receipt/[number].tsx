import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Share, View } from 'react-native';
import { Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

/**
 * A gift receipt (p10-22): what's in the box and the card, without prices, to show or share
 * with the person receiving it.
 */
export default function GiftReceiptScreen() {
  const t = useT('gift');
  const p = usePalette();
  const { status } = useSession();
  const { number, token } = useLocalSearchParams<{ number: string; token?: string }>();
  const order = useQuery({
    queryKey: keys.order(number),
    queryFn: () => api.orders.get(number, token),
    enabled: !!token || status === 'signedIn',
  });
  if (order.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  const o = order.data;
  if (!o?.gift) return <Screen>{<EmptyState title={t('receiptTitle')} />}</Screen>;
  const lead = o.gift.from ? t('receiptLead', { from: o.gift.from }) : t('receiptLeadAnon');
  const items = o.items.map(
    (i) => `${i.productTitle} · ${i.variantTitle} · ${t('qty', { count: i.quantity })}`,
  );
  const share = () =>
    void Share.share({
      title: t('receiptTitle'),
      message: [
        t('receiptTitle'),
        lead,
        ...(o.gift?.message ? [`“${o.gift.message}”`] : []),
        '',
        ...items,
        '',
        t('receiptOrder', { number: o.number }),
        t('receiptReturns'),
      ].join('\n'),
    });
  return (
    <Screen>
      <Card style={{ gap: space.md }}>
        <Text variant="label" muted>
          NIXZORA
        </Text>
        <Text variant="title">{t('receiptTitle')}</Text>
        <Text>{lead}</Text>
        {o.gift.message ? (
          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: p.signalText,
              paddingLeft: space.md,
              paddingVertical: space.xs,
            }}
          >
            <Text style={{ fontSize: 18, lineHeight: 26, color: p.fg }}>{o.gift.message}</Text>
          </View>
        ) : null}
        <View style={{ gap: space.sm }}>
          {o.items.map((item) => (
            <View
              key={item.id}
              style={{ gap: 2, paddingBottom: space.sm, borderBottomWidth: 1, borderColor: p.line }}
            >
              <Text style={{ fontFamily: fonts.bodyMedium }}>{item.productTitle}</Text>
              <Text variant="small" muted>
                {item.variantTitle} · {t('qty', { count: item.quantity })}
              </Text>
            </View>
          ))}
        </View>
        <Text muted>{t('receiptOrder', { number: o.number })}</Text>
        <Text variant="small" muted>
          {t('receiptReturns')}
        </Text>
      </Card>
      <Button title={t('share')} onPress={share} />
    </Screen>
  );
}
