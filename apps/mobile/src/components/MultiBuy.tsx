import Ionicons from '@expo/vector-icons/Ionicons';
import { multiBuyAddMore, multiBuyTerms } from '@nixzora/i18n';
import { type CardMultiBuy, type CartMultiBuy } from '@nixzora/validation';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';

/** "Buy 2, get 1 free" (p10-27) as a small outlined tag, on cards and the product page. */
export function OfferTag({ offer }: { offer: CardMultiBuy }) {
  const t = useT('multiBuy');
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
        {multiBuyTerms(t, offer)}
      </Text>
    </View>
  );
}

/** The product page's offer: its terms, when it ends, and a way to mix and match. */
export function OfferRow({ offer }: { offer: CardMultiBuy }) {
  const t = useT('multiBuy');
  const f = useFormatters();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(`/offers/${offer.id}`)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}
    >
      <OfferTag offer={offer} />
      {offer.endsAt ? (
        <Text variant="small" muted>
          {t('endsOn', { date: f.shortDate(offer.endsAt) })}
        </Text>
      ) : null}
      <Text variant="small" style={{ textDecorationLine: 'underline' }}>
        {t('shopOffer')} →
      </Text>
    </Pressable>
  );
}

/** In the cart: what each offer saved, and how many more items would get the next reward. */
export function CartOffers({ offers }: { offers: CartMultiBuy[] }) {
  const t = useT('multiBuy');
  const { money } = useFormatters();
  const p = usePalette();
  if (!offers.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      {offers.map((offer) => (
        <View key={offer.id} style={{ gap: 2 }}>
          <Text variant="small">
            <Text variant="small" style={{ fontFamily: fonts.bodyBold }}>
              {multiBuyTerms(t, offer)}
            </Text>
            {offer.discountCents ? ` · −${money(offer.discountCents)}` : ''}
          </Text>
          {offer.addMore ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/offers/${offer.id}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
            >
              <Ionicons name="pricetag-outline" size={14} color={p.signalText} />
              <Text
                variant="small"
                style={{ color: p.signalText, textDecorationLine: 'underline', flexShrink: 1 }}
              >
                {multiBuyAddMore(t, offer)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
