import { deliveryDay, INTL_LOCALE } from '@nixzora/i18n';
import { type ProductCard, twoDayWindow } from '@nixzora/validation';
import { View } from 'react-native';
import { usePlusMember } from '@/lib/hooks';
import { useLocale, useT } from '@/lib/i18n';
import { fonts } from '@/lib/theme';
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
export function DeliveryLine({ product }: { product: ProductCard }) {
  const t = useT('product');
  const locale = useLocale();
  const member = usePlusMember();
  if (!product.inStock) return null;
  const twoDay = member && product.shipsFromNixzora === true;
  const window = twoDay ? twoDayWindow(new Date()) : product.delivery;
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      {twoDay ? <PlusChip /> : null}
      <Text variant="small" style={{ flexShrink: 1 }}>
        {before}
        <Text variant="small" style={{ fontFamily: fonts.bodyBold }}>
          {when}
        </Text>
        {after}
      </Text>
    </View>
  );
}
