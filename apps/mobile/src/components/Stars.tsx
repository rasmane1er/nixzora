import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { brand } from '@/lib/theme';
import { Text } from './ui';

export function Stars({ average, count }: { average: number | null; count: number }) {
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
          size={14}
          color={brand.signal}
        />
      ))}
      <Text variant="small" muted style={{ marginLeft: 4 }}>
        {rating(average)} ({count})
      </Text>
    </View>
  );
}
