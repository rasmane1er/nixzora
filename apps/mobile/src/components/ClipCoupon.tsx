import type { ProductCard } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { fonts, space } from '@/lib/theme';
import { Text } from './ui';

export const COUPON_GREEN = '#166534';
const clippedKey = ['clipped-coupons'] as const;

/** "Save 15% with coupon" / "Save $5.00 with coupon" (p10-18). */
export function useCouponLabel() {
  const t = useT('clips');
  const { money, percent } = useFormatters();
  return (coupon: NonNullable<ProductCard['coupon']>) =>
    coupon.kind === 'PERCENT'
      ? t('badgePercent', { percent: percent((coupon.percentOff ?? 0) / 100) })
      : t('badgeAmount', { amount: money(coupon.amountOffCents ?? 0) });
}

/** The green "Save 15% with coupon" tag on a product card. */
export function CouponTag({ coupon }: { coupon: NonNullable<ProductCard['coupon']> }) {
  const label = useCouponLabel();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: '#DCFCE7',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <Text variant="small" style={{ color: COUPON_GREEN, fontFamily: fonts.bodyBold }}>
        {label(coupon)}
      </Text>
    </View>
  );
}

/** The shopper's clipped coupon ids (signed in), shared by every clip button. */
export function useClipped() {
  const { status } = useSession();
  return useQuery({
    queryKey: clippedKey,
    queryFn: () => api.account.clippedCoupons(),
    enabled: status === 'signedIn',
    staleTime: 60_000,
  });
}

/**
 * Clip coupons (p10-18): "Clip coupon" ↔ "Coupon clipped ✓", the same as the website. A
 * signed-out shopper is sent to sign in.
 */
export function ClipCouponButton({ coupon }: { coupon: NonNullable<ProductCard['coupon']> }) {
  const t = useT('clips');
  const label = useCouponLabel();
  const { status } = useSession();
  const client = useQueryClient();
  const clipped = useClipped();
  const on = (clipped.data ?? []).includes(coupon.id);
  const toggle = useMutation({
    mutationFn: async (): Promise<void> => {
      if (on) await api.account.unclipCoupon(coupon.id);
      else await api.account.clipCoupon(coupon.id);
    },
    onSuccess: async () => {
      client.setQueryData<string[]>(clippedKey, (ids = []) =>
        on ? ids.filter((id) => id !== coupon.id) : [...ids, coupon.id],
      );
      await client.invalidateQueries({ queryKey: ['cart'] });
    },
  });
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, busy: toggle.isPending }}
        disabled={toggle.isPending}
        onPress={() => (status === 'signedIn' ? toggle.mutate() : router.push('/sign-in'))}
        style={{
          flexDirection: 'row',
          gap: space.sm,
          alignItems: 'center',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: '#16A34A',
          backgroundColor: '#F0FDF4',
          borderRadius: 10,
          padding: space.sm,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: '#16A34A',
            backgroundColor: on ? '#16A34A' : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {on ? <Text style={{ color: '#FFFFFF', fontFamily: fonts.bodyBold }}>✓</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#14532D', fontFamily: fonts.bodyBold }}>{label(coupon)}</Text>
          <Text variant="small" style={{ color: '#14532D', textDecorationLine: 'underline' }}>
            {status !== 'signedIn'
              ? t('signInToClip')
              : toggle.isPending
                ? t('clipping')
                : on
                  ? t('clipped')
                  : t('clip')}
          </Text>
        </View>
      </Pressable>
      {on ? (
        <Text variant="small" muted>
          {t('clippedNote')}
        </Text>
      ) : null}
      {toggle.error ? (
        <Text variant="small" tone="error">
          {(toggle.error as Error).message}
        </Text>
      ) : null}
    </View>
  );
}
