import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { brand } from '@/lib/theme';
import { Text } from './ui';

export function Stars({ average, count }: { average: number | null; count: number }) {
  if (!count || average == null) return null;
  const rounded = Math.round(average * 2) / 2;
  return (
    <View
      accessible
      accessibilityLabel={`Rated ${average.toFixed(1)} out of 5 from ${count} review${count === 1 ? '' : 's'}`}
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
        {average.toFixed(1)} ({count})
      </Text>
    </View>
  );
}
