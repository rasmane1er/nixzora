import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ClipCouponButton } from '@/components/ClipCoupon';
import { Card, EmptyState, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space } from '@/lib/theme';

/** Clip coupons (p10-18): every live coupon, with its clip button. */
export default function CouponsScreen() {
  const t = useT('clips');
  const { money, shortDate } = useFormatters();
  const page = useQuery({ queryKey: ['catalog', 'coupons'], queryFn: () => api.catalog.coupons() });
  const coupons = page.data?.coupons ?? [];
  return (
    <Screen>
      <Text muted>{t('pageLead')}</Text>
      {page.data && !coupons.length ? <EmptyState title={t('none')} /> : null}
      {coupons.map((c) => (
        <Card key={c.id} style={{ gap: space.sm }}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(`/p/${c.product.slug}`)}
            style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}
          >
            {c.product.image ? (
              <Image
                source={{ uri: c.product.image.url }}
                style={{ width: 72, height: 54, borderRadius: 8 }}
                contentFit="cover"
              />
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={2} style={{ fontFamily: fonts.bodyMedium }}>
                {c.product.title}
              </Text>
              <Text variant="small" muted>
                {money(c.product.priceFromCents)} · {t('endsOn', { date: shortDate(c.endsAt) })}
              </Text>
            </View>
          </Pressable>
          <ClipCouponButton coupon={c} />
        </Card>
      ))}
    </Screen>
  );
}
