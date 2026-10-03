import { errorMessage } from '@nixzora/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { Banner, Button, Card, EmptyState, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormat, useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { fonts, space, usePalette } from '@/lib/theme';

const STATUS = {
  OPEN: { label: 'supportOpen', tone: 'warn' },
  ANSWERED: { label: 'supportAnswered', tone: 'ok' },
  CLOSED: { label: 'supportClosed', tone: 'neutral' },
} as const;

/** The customer's messages to support and our replies. */
export default function SupportRequestsScreen() {
  const p = usePalette();
  const t = useT('appAccount');
  const th = useT('help');
  const f = useFormat();
  const requests = useQuery({
    queryKey: keys.supportRequests,
    queryFn: () => api.me.supportRequests(),
  });

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={requests.isRefetching}
          onRefresh={() => void requests.refetch()}
        />
      }
    >
      {requests.error ? <Banner tone="error">{errorMessage(requests.error)}</Banner> : null}
      {requests.data && requests.data.length === 0 ? (
        <EmptyState title={t('supportEmptyTitle')} body={t('supportEmptyBody')} />
      ) : null}
      {requests.data?.map((r) => (
        <Card key={r.id} style={{ gap: space.sm }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bodyMedium }}>{r.subject}</Text>
              <Text variant="small" muted>
                {r.reference} · {th(`topic_${r.topic}`)} · {f.date(r.createdAt)}
                {r.orderNumber ? ` · ${r.orderNumber}` : ''}
              </Text>
            </View>
            <Pill label={t(STATUS[r.status].label)} tone={STATUS[r.status].tone} />
          </Row>
          <Text muted numberOfLines={4}>
            {r.message}
          </Text>
          {r.staffReply ? (
            <View
              style={{
                gap: 4,
                padding: space.sm,
                borderLeftWidth: 3,
                borderLeftColor: p.fg,
                backgroundColor: p.bg,
              }}
            >
              <Text variant="label" muted>
                {t('supportReplied')}
                {r.answeredAt ? ` · ${f.date(r.answeredAt)}` : ''}
              </Text>
              <Text selectable>{r.staffReply}</Text>
            </View>
          ) : null}
        </Card>
      ))}
      <Button
        title={th('contactSupport')}
        tone="ghost"
        onPress={() => router.push('/help/contact')}
      />
    </Screen>
  );
}
