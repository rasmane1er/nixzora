import { Pressable, ScrollView } from 'react-native';
import { fonts, space, usePalette } from '@/lib/theme';
import { Text } from './ui';

/** A row of single-choice chips (filters such as the deal type). */
export function Chips<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: string }[];
}) {
  const p = usePalette();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={{
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderColor: active ? p.fg : p.line,
              backgroundColor: active ? p.fg : 'transparent',
            }}
          >
            <Text
              variant="small"
              style={{ fontFamily: fonts.bodyMedium, color: active ? p.bg : p.fg }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
