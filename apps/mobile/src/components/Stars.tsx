import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { brand } from '@/lib/theme';
import { Text } from './ui';

export function Stars({
  average,
  count,
  compact,
}: {
  average: number | null;
  count: number;
  /** Smaller, for product cards. */
  compact?: boolean;
}) {
  const t = useT('appShop');
  const { rating } = useFormatters();
  if (!count || average == null) return null;
  const rounded = Math.round(average * 2) / 2;
  return (
    <View
      accessible
      accessibilityLabel={t('starsLabel', { rating: rating(average), count })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={rounded >= n ? 'star' : rounded >= n - 0.5 ? 'star-half' : 'star-outline'}
          size={compact ? 12 : 14}
          color={brand.signal}
        />
      ))}
      <Text variant="small" muted style={[{ marginLeft: 4 }, compact && { fontSize: 12 }]}>
        {rating(average)} ({count})
      </Text>
    </View>
  );
}
