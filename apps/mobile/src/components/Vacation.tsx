import { calendarDay } from '@nixzora/i18n';
import type { StoreAway } from '@nixzora/validation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { useLocale, useT } from '@/lib/i18n';
import { space, usePalette } from '@/lib/theme';
import { Text } from './ui';

/**
 * Store vacation mode (p10-32): the store is away, so orders wait until it's back. On a
 * product page (with the store's name) or the store's own page.
 */
export function AwayNotice({ away, store }: { away: StoreAway; store?: string }) {
  const t = useT('vacation');
  const locale = useLocale();
  const p = usePalette();
  const date = away.until ? calendarDay(away.until, locale) : null;
  const text = store
    ? date
      ? t('awayBanner', { store, date })
      : t('awayBannerOpen', { store })
    : date
      ? t('storeBanner', { date })
      : t('storeBannerOpen');
  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        gap: space.sm,
        padding: space.md,
        borderRadius: 14,
        backgroundColor: p.warnBg,
      }}
    >
      <Ionicons name="airplane-outline" size={18} color={p.warnFg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="small" style={{ color: p.warnFg }}>
          {text}
        </Text>
        {away.message ? (
          <Text variant="small" style={{ color: p.warnFg, fontStyle: 'italic' }}>
            {t('note', { message: away.message })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** On a card: "Store away · back Nov 10", in place of the delivery date. */
export function AwayLine({ until }: { until: string | null }) {
  const t = useT('vacation');
  const locale = useLocale();
  const p = usePalette();
  return (
    <Text variant="small" style={{ color: p.warnFg }}>
      {until ? t('awayShort', { date: calendarDay(until, locale) }) : t('awayShortOpen')}
    </Text>
  );
}
