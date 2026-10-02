import { View } from 'react-native';
import { money } from '@/lib/format';
import { fonts } from '@/lib/theme';
import { Text } from './ui';

export function Price({
  cents,
  compareAtCents,
  currency = 'USD',
  size = 'md',
}: {
  cents: number;
  compareAtCents?: number | null;
  currency?: string;
  size?: 'md' | 'lg';
}) {
  const onSale = compareAtCents != null && compareAtCents > cents;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
      <Text
        tone={onSale ? 'signal' : undefined}
        style={{ fontFamily: fonts.displayMedium, fontSize: size === 'lg' ? 24 : 16 }}
        accessibilityLabel={
          onSale ? `${money(cents, currency)}, was ${money(compareAtCents, currency)}` : undefined
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
