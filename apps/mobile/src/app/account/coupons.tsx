import { errorMessage } from '@nixzora/api-client';
import type { AccountCoupon } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, View } from 'react-native';
import { Banner, Card, EmptyState, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormat, useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';

/** Current public promotions. Codes are entered in the cart. */
export default function CouponsScreen() {
  const p = usePalette();
  const t = useT('appAccount');
  const f = useFormat();
  const coupons = useQuery({ queryKey: keys.coupons, queryFn: () => api.me.coupons() });
  const amount = (c: AccountCoupon) =>
    t('couponOff', {
      amount: c.type === 'PERCENT' ? f.percent(c.value / 10000) : f.money(c.value),
    });

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={coupons.isRefetching}
          onRefresh={() => void coupons.refetch()}
        />
      }
    >
      <Text muted>{t('couponsIntro')}</Text>
      {coupons.error ? <Banner tone="error">{errorMessage(coupons.error)}</Banner> : null}
      {coupons.data && coupons.data.length === 0 ? (
        <EmptyState title={t('couponsEmptyTitle')} body={t('couponsEmptyBody')} />
      ) : null}
      {coupons.data?.map((c) => (
        <Card key={c.code} style={{ gap: space.sm, opacity: c.used ? 0.6 : 1 }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: 6,
                borderRadius: radius,
                backgroundColor: brand.signal,
              }}
            >
              <Text style={{ color: '#fff', fontFamily: fonts.bodyMedium }}>{amount(c)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bodyMedium }}>{c.description ?? amount(c)}</Text>
              <Text variant="small" muted>
                {c.minSubtotalCents
                  ? t('couponsMin', { amount: f.money(c.minSubtotalCents) })
                  : t('couponsNoMin')}
                {c.endsAt ? ` · ${t('couponsUntil', { date: f.date(c.endsAt) })}` : ''}
              </Text>
            </View>
          </Row>
          <Row>
            <Text
              variant="mono"
              selectable
              accessibilityLabel={t('couponsCodeA11y', { code: c.code })}
              style={{
                flex: 1,
                padding: space.sm,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: p.line,
                borderRadius: radius,
                textAlign: 'center',
                letterSpacing: 1,
              }}
            >
              {c.code}
            </Text>
            {c.used ? <Pill label={t('couponsUsed')} /> : null}
          </Row>
        </Card>
      ))}
      <Text variant="small" muted>
        {t('couponsGiftCards')}
      </Text>
    </Screen>
  );
}
