import Ionicons from '@expo/vector-icons/Ionicons';
import { deliveryRange } from '@nixzora/i18n';
import type { DeliveryWindow, TrackingStep } from '@nixzora/validation';
import { View } from 'react-native';
import { useFormatters } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { brand, fonts, space, usePalette } from '@/lib/theme';
import { Text } from './ui';

/** "Arrives Thu, Oct 15 – Tue, Oct 20" (p10-04), shared rule with the website. */
export function DeliveryPromise({ window }: { window: DeliveryWindow | null | undefined }) {
  const p = usePalette();
  const d = useT('delivery');
  const locale = useLocale();
  if (!window) return null;
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
      <Ionicons name="car-outline" size={18} color={p.okFg} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyBold }}>
          {d('arrives', { range: deliveryRange(window, locale) })}
        </Text>
        <Text variant="small" muted>
          {d('arrivesHint')}
        </Text>
      </View>
    </View>
  );
}

/** "Expected Thu, Oct 15 – Tue, Oct 20" on an order that has not arrived. */
export function ExpectedDelivery({ window }: { window: DeliveryWindow | null | undefined }) {
  const d = useT('delivery');
  const locale = useLocale();
  if (!window) return null;
  return (
    <Text variant="small" style={{ fontFamily: fonts.bodyMedium }}>
      {d('expected', { range: deliveryRange(window, locale) })}
    </Text>
  );
}

/** Carrier scans for one parcel, newest first. */
export function TrackingScans({ events }: { events: TrackingStep[] | undefined }) {
  const p = usePalette();
  const d = useT('delivery');
  const { dateTime } = useFormatters();
  if (!events?.length) {
    return (
      <Text variant="small" muted>
        {d('noScans')}
      </Text>
    );
  }
  return (
    <View
      accessibilityRole="list"
      accessibilityLabel={d('trackingTitle')}
      style={{ gap: space.sm }}
    >
      {events.map((event, i) => (
        <View key={`${event.at}-${event.status}`} style={{ flexDirection: 'row', gap: space.sm }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              marginTop: 5,
              backgroundColor:
                event.status === 'DELIVERED'
                  ? p.okFg
                  : event.status === 'EXCEPTION'
                    ? p.errFg
                    : i === 0
                      ? brand.signal
                      : p.line,
            }}
          />
          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="small" style={{ fontFamily: fonts.bodyMedium }}>
              {d(`step_${event.status}`)}
            </Text>
            <Text variant="small">{event.description}</Text>
            <Text variant="small" muted>
              {dateTime(event.at)}
              {event.location ? ` · ${event.location}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
