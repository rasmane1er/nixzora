import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useT } from '@/lib/i18n';
import { fonts, usePalette } from '@/lib/theme';
import { Text } from './ui';

export const MAX_QUANTITY = 20;

export function QuantityStepper({
  value,
  max = MAX_QUANTITY,
  onChange,
  disabled,
  label: labelProp,
  compact,
}: {
  value: number;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  label?: string;
  /** Slimmer, for tight bars on narrow phones. */
  compact?: boolean;
}) {
  const p = usePalette();
  const t = useT('appShop');
  const label = labelProp ?? t('quantity');
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
        compact && styles.compactButton,
        { borderColor: p.line, opacity: disabled || !enabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={p.fg} />
    </Pressable>
  );
  return (
    <View
      style={[styles.row, compact && { gap: 2 }]}
      accessible={false}
      accessibilityLabel={`${label}: ${value}`}
      accessibilityValue={{ min: 0, max: limit, now: value }}
    >
      {button('remove', value - 1, value > 0, t('decrease', { label: label.toLowerCase() }))}
      <Text style={{ fontFamily: fonts.mono, minWidth: compact ? 20 : 28, textAlign: 'center' }}>
        {value}
      </Text>
      {button('add', value + 1, value < limit, t('increase', { label: label.toLowerCase() }))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactButton: { width: 30, height: 30, borderRadius: 15 },
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
