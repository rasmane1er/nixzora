import { errorMessage } from '@nixzora/api-client';
import type { AccountCoupon } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, View } from 'react-native';
import { Banner, Card, EmptyState, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { keys } from '@/lib/query';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';

function amount(c: AccountCoupon): string {
  return c.type === 'PERCENT' ? `${c.value / 100}% off` : `${money(c.value)} off`;
}

/** Current public promotions. Codes are entered in the cart. */
export default function CouponsScreen() {
  const p = usePalette();
  const coupons = useQuery({ queryKey: keys.coupons, queryFn: () => api.me.coupons() });

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={coupons.isRefetching}
          onRefresh={() => void coupons.refetch()}
        />
      }
    >
      <Text muted>Enter a code in your cart. One code per order.</Text>
      {coupons.error ? <Banner tone="error">{errorMessage(coupons.error)}</Banner> : null}
      {coupons.data && coupons.data.length === 0 ? (
        <EmptyState title="No promotions right now" body="Check back soon." />
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
                  ? `On orders of ${money(c.minSubtotalCents)} or more`
                  : 'No minimum'}
                {c.endsAt ? ` · until ${shortDate(c.endsAt)}` : ''}
              </Text>
            </View>
          </Row>
          <Row>
            <Text
              variant="mono"
              selectable
              accessibilityLabel={`Code ${c.code}`}
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
            {c.used ? <Pill label="Used" /> : null}
          </Row>
        </Card>
      ))}
      <Text variant="small" muted>
        Gift cards and store credit are not available yet.
      </Text>
    </Screen>
  );
}
