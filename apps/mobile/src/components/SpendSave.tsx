import { spendTiers } from '@nixzora/i18n';
import type { CartSpendOffer, SpendOfferBrief } from '@nixzora/validation';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';
import { Text } from './ui';

/** The tag, as on the web: "Spend more, save more". */
function Tag() {
  const t = useT('spendSave');
  const p = usePalette();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: p.signalText,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <Text variant="small" style={{ color: p.signalText, fontFamily: fonts.bodyBold }}>
        {t('title')}
      </Text>
    </View>
  );
}

/** Spend more, save more (p10-31) on a product page: the store's tiers. */
export function SpendRow({
  offer,
  store,
}: {
  offer: SpendOfferBrief;
  /** The store that sells it; null is NIXZORA. */
  store: { handle: string; displayName: string } | null;
}) {
  const t = useT('spendSave');
  const p = usePalette();
  const f = useFormatters();
  return (
    <View style={{ gap: 4, padding: space.md, borderRadius: 14, backgroundColor: p.tint }}>
      <Tag />
      <Text style={{ fontFamily: fonts.bodyBold }}>{spendTiers(t, offer.tiers, f.money)}</Text>
      <Text variant="small" muted>
        {store ? t('onStore', { store: store.displayName }) : t('onNixzora')}
        {offer.endsAt ? ` ${t('endsOn', { date: f.shortDate(offer.endsAt) })}` : ''}
      </Text>
      {store ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(`/s/${store.handle}`)}
          hitSlop={6}
          style={{ minHeight: 32, justifyContent: 'center' }}
        >
          <Text variant="small" style={{ textDecorationLine: 'underline' }}>
            {t('shopStore', { store: store.displayName })} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** In the cart: what each store's tiers saved, or how much more reaches the next one. */
export function CartSpend({ offers }: { offers: CartSpendOffer[] }) {
  const t = useT('spendSave');
  const { money } = useFormatters();
  if (!offers.length) return null;
  return (
    <View style={{ gap: space.md }}>
      <Tag />
      {offers.map((o) => {
        const store = o.seller?.displayName ?? t('nixzora');
        return (
          <View key={o.id} style={{ gap: 4 }}>
            {o.discountCents ? (
              <Text variant="small" tone="ok" style={{ fontFamily: fonts.bodyBold }}>
                {t('reached', { off: money(o.discountCents), store })}
              </Text>
            ) : null}
            {o.next ? (
              <Text variant="small">
                {t('more', {
                  amount: money(o.next.moreCents),
                  store,
                  off: money(o.next.offCents),
                })}
              </Text>
            ) : null}
            {o.seller && o.next ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push(`/s/${o.seller!.handle}`)}
                hitSlop={6}
              >
                <Text variant="small" style={{ textDecorationLine: 'underline' }}>
                  {t('shopStore', { store })} →
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
