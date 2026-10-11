import { deliveryDay, INTL_LOCALE } from '@nixzora/i18n';
import { type ProductCard, shownDelivery } from '@nixzora/validation';
import { View } from 'react-native';
import { usePlusMember } from '@/lib/hooks';
import { useLocale, useT } from '@/lib/i18n';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { fonts, usePalette } from '@/lib/theme';
import { PlusChip } from './PlusNote';
import { Text } from './ui';

/** "50+ bought in past month" (p10-17); nothing below 10. */
export function BoughtLine({ product }: { product: ProductCard }) {
  const t = useT('product');
  const locale = useLocale();
  if (product.boughtPastMonth == null) return null;
  const count = new Intl.NumberFormat(INTL_LOCALE[locale], { notation: 'compact' }).format(
    product.boughtPastMonth,
  );
  return (
    <Text variant="small" muted>
      {t('boughtPastMonth', { count })}
    </Text>
  );
}

/**
 * "FREE delivery Tomorrow, Oct 11" (p10-17), the same rule as the website: Plus members get
 * NIXZORA's own items in 2 days, free; everyone else the standard date, free over the line.
 */
export function DeliveryLine({ product, compact }: { product: ProductCard; compact?: boolean }) {
  const t = useT('product');
  const locale = useLocale();
  const member = usePlusMember();
  const p = usePalette();
  if (!product.inStock) return null;
  const twoDay = member && product.shipsFromNixzora === true;
  // From the release day for a pre-order (p10-30).
  const window = shownDelivery(product, twoDay);
  if (!window) return null;
  const day = deliveryDay(window.latest, locale);
  const when = day.tomorrow
    ? t('deliveryTomorrow', { date: day.text })
    : window.earliest === window.latest
      ? day.text
      : t('deliveryBy', { date: day.text });
  const key = twoDay
    ? 'deliveryPlus'
    : member || product.freeDelivery
      ? 'deliveryFree'
      : 'deliveryPaid';
  const [before, after = ''] = t(key, { date: '\u0000' }).split('\u0000');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5 }}>
      {/* The redesign (ADR-0053): a delivery truck leads the line. */}
      <MaterialCommunityIcons
        name="truck-outline"
        size={compact ? 15 : 16}
        color={p.muted}
        style={{ marginTop: compact ? 0 : 1 }}
      />
      {twoDay ? <PlusChip /> : null}
      <Text variant="small" style={[{ flex: 1 }, compact && { fontSize: 12, lineHeight: 16 }]}>
        {before}
        <Text
          variant="small"
          style={[{ fontFamily: fonts.bodyBold }, compact && { fontSize: 12, lineHeight: 16 }]}
        >
          {when}
        </Text>
        {after}
      </Text>
    </View>
  );
}

/**
 * One line for result rows (ADR-0053): "Free · Tue, Oct 20" (or just the day when shipping
 * isn't free; Plus members' 2-day items lead with the Plus chip).
 */
export function ShortDelivery({ product, narrow }: { product: ProductCard; narrow?: boolean }) {
  const t = useT('product');
  const tu = useT('shopUi');
  const locale = useLocale();
  const member = usePlusMember();
  const p = usePalette();
  if (!product.inStock) return null;
  const twoDay = member && product.shipsFromNixzora === true;
  const window = shownDelivery(product, twoDay);
  if (!window) return null;
  const day = deliveryDay(window.latest, locale);
  // Narrow phones drop the weekday: "Free · Oct 20".
  const text = narrow
    ? new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${window.latest}T12:00:00Z`))
    : day.text;
  const when = day.tomorrow ? t('deliveryTomorrow', { date: text }) : text;
  const free = twoDay || member || product.freeDelivery;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <MaterialCommunityIcons name="truck-outline" size={15} color={p.muted} />
      {twoDay ? <PlusChip /> : null}
      <Text
        variant="small"
        numberOfLines={1}
        style={{ flexShrink: 1, fontSize: 12, lineHeight: 16, color: p.muted }}
      >
        {free ? `${tu('freeShort')} · ` : ''}
        <Text variant="small" style={{ fontSize: 12, lineHeight: 16, fontFamily: fonts.bodyBold }}>
          {when}
        </Text>
      </Text>
    </View>
  );
}
