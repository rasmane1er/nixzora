import type { Totals } from '@nixzora/validation';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';
import { Text } from './ui';

/** NIXZORA Plus's accent (p10-15), the same on the website. */
export const PLUS_ACCENT = '#3D2DB8';

/** A small "Plus" chip. */
export function PlusChip({ label }: { label?: string }) {
  const t = useT('plus');
  return (
    <View
      style={{
        backgroundColor: PLUS_ACCENT,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 1,
        alignSelf: 'flex-start',
      }}
    >
      <Text variant="small" style={{ color: '#FFFFFF', fontFamily: fonts.bodyBold }}>
        {label ?? t('badge')}
      </Text>
    </View>
  );
}

/** Under a cart or checkout summary: the member's 2-day promise, or what Plus would save. */
export function PlusShippingNote({ totals }: { totals: Totals }) {
  const t = useT('plus');
  const p = usePalette();
  const { money } = useFormatters();
  const member = totals.shippingWaivedCents !== undefined;
  if (!member && !totals.shippingCents) return null;
  const text = member
    ? totals.shippingSpeed === 'TWO_DAY'
      ? t('twoDayWithPlus')
      : t('freeWithPlus')
    : t('upsellShipping', { amount: money(totals.shippingCents, totals.currency) });
  return (
    <Pressable
      accessibilityRole={member ? undefined : 'link'}
      disabled={member}
      onPress={() => router.push('/plus')}
      style={{
        flexDirection: 'row',
        gap: space.sm,
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: space.sm,
        borderRadius: 12,
        backgroundColor: p.tile,
      }}
    >
      <PlusChip />
      {/* On the inverted tile, text takes the tile's own foreground (it was ink on ink). */}
      <Text variant="small" style={{ flexShrink: 1, color: p.tileFg }}>
        {text}
        {member ? '' : ' · '}
        {member ? null : (
          <Text
            variant="small"
            style={{
              color: p.tileFg,
              fontFamily: fonts.bodyBold,
              textDecorationLine: 'underline',
            }}
          >
            {t('upsellCta')}
          </Text>
        )}
      </Text>
    </Pressable>
  );
}

/** "$40.00 with Plus" for a member-only deal on a product. */
export function PlusPriceText({
  priceCents,
  percentOff,
}: {
  priceCents: number;
  percentOff: number;
}) {
  const t = useT('plus');
  const { money } = useFormatters();
  return (
    <Text variant="small" style={{ color: PLUS_ACCENT, fontFamily: fonts.bodyBold }}>
      {t('memberPrice', {
        price: money(Math.max(1, Math.round((priceCents * (100 - percentOff)) / 100))),
      })}
    </Text>
  );
}
