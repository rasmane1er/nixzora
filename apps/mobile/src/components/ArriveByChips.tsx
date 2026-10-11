import Ionicons from '@expo/vector-icons/Ionicons';
import { calendarDay } from '@nixzora/i18n';
import { arriveByChoices } from '@nixzora/validation';
import { useMemo } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';
import { Text } from './ui';

/** "Get it by" (p10-37): only what arrives by the chosen day; tap again to clear. */
export function ArriveByChips({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (day: string | undefined) => void;
}) {
  const p = usePalette();
  const t = useT('arriveBy');
  const { locale } = useFormatters();
  const days = useMemo(() => arriveByChoices(), []);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, alignItems: 'center' }}
      accessibilityLabel={t('label')}
    >
      <Text variant="small" style={{ fontFamily: fonts.bodyBold }}>
        {t('label')}
      </Text>
      {days.map((day) => {
        const active = day === value;
        const date = calendarDay(day, locale);
        return (
          <Pressable
            key={day}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={t('a11y', { date })}
            onPress={() => onChange(active ? undefined : day)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderColor: active ? p.fg : p.line,
              backgroundColor: active ? p.fg : 'transparent',
            }}
          >
            <Ionicons name="car-outline" size={14} color={active ? p.bg : p.fg} />
            <Text
              variant="small"
              style={{ fontFamily: fonts.bodyMedium, color: active ? p.bg : p.fg }}
            >
              {t('chip', { date })}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
