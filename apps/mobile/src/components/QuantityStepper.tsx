import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { fonts, usePalette } from '@/lib/theme';
import { Text } from './ui';

export const MAX_QUANTITY = 20;

export function QuantityStepper({
  value,
  max = MAX_QUANTITY,
  onChange,
  disabled,
  label = 'Quantity',
}: {
  value: number;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const p = usePalette();
  const limit = Math.min(max, MAX_QUANTITY);
  const button = (icon: 'remove' | 'add', next: number, enabled: boolean, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled || !enabled}
      onPress={() => onChange(next)}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { borderColor: p.line, opacity: disabled || !enabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={p.fg} />
    </Pressable>
  );
  return (
    <View
      style={styles.row}
      accessible={false}
      accessibilityLabel={`${label}: ${value}`}
      accessibilityValue={{ min: 0, max: limit, now: value }}
    >
      {button('remove', value - 1, value > 0, `Decrease ${label.toLowerCase()}`)}
      <Text style={{ fontFamily: fonts.mono, minWidth: 28, textAlign: 'center' }}>{value}</Text>
      {button('add', value + 1, value < limit, `Increase ${label.toLowerCase()}`)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
