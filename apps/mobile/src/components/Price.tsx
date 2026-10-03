import { View } from 'react-native';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts } from '@/lib/theme';
import { Text } from './ui';

export function Price({
  cents,
  compareAtCents,
  currency = 'USD',
  size = 'md',
  prefix,
}: {
  cents: number;
  compareAtCents?: number | null;
  currency?: string;
  size?: 'md' | 'lg';
  /** "From" when the product has options at different prices. */
  prefix?: string;
}) {
  const { money } = useFormatters();
  const t = useT('appShop');
  const onSale = compareAtCents != null && compareAtCents > cents;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
      {prefix ? (
        <Text variant="small" muted>
          {prefix}
        </Text>
      ) : null}
      <Text
        tone={onSale ? 'signal' : undefined}
        style={{ fontFamily: fonts.displayMedium, fontSize: size === 'lg' ? 24 : 16 }}
        accessibilityLabel={
          onSale
            ? t('priceWas', {
                price: money(cents, currency),
                was: money(compareAtCents, currency),
              })
            : undefined
        }
      >
        {money(cents, currency)}
      </Text>
      {onSale ? (
        <Text variant="small" muted style={{ textDecorationLine: 'line-through' }}>
          {money(compareAtCents, currency)}
        </Text>
      ) : null}
    </View>
  );
}
