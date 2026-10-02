import { Pressable, ScrollView } from 'react-native';
import { fonts, space, usePalette } from '@/lib/theme';
import { Text } from './ui';

export type Sort = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

const LABELS: Record<Sort, string> = {
  relevance: 'Best match',
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};

export function SortChips({
  value,
  onChange,
  options = ['relevance', 'newest', 'price_asc', 'price_desc'],
}: {
  value: Sort;
  onChange: (sort: Sort) => void;
  options?: Sort[];
}) {
  const p = usePalette();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm }}
    >
      {options.map((sort) => {
        const active = sort === value;
        return (
          <Pressable
            key={sort}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(sort)}
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
              {LABELS[sort]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
