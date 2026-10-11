import Ionicons from '@expo/vector-icons/Ionicons';
import { calendarDay } from '@nixzora/i18n';
import type { CartLine } from '@nixzora/validation';
import { PressableLink } from './PressableLink';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { optionsText, useFormatters } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { cardShadow, fonts, radius, space, usePalette } from '@/lib/theme';
import { QuantityStepper } from './QuantityStepper';
import { PlusChip } from './PlusNote';
import { Text } from './ui';

export function CartLineRow({
  line,
  busy,
  onQuantity,
  onSave,
}: {
  line: CartLine;
  busy?: boolean;
  onQuantity: (quantity: number) => void;
  /** Saved for later (p10-21). */
  onSave?: () => void;
}) {
  const ts = useT('saved');
  const p = usePalette();
  const { money } = useFormatters();
  const t = useT('appShop');
  const tc = useT('cart');
  const tpl = useT('plus');
  const tpo = useT('preorders');
  const tu = useT('shopUi');
  const locale = useLocale();
  const options = optionsText(line.options);
  return (
    <View style={[styles.row, cardShadow, { backgroundColor: p.card }]}>
      <PressableLink
        href={`/p/${line.productSlug}?variant=${line.variantId}`}
        accessibilityLabel={line.productTitle}
        style={[styles.thumb, { backgroundColor: p.photo }]}
      >
        {line.imageUrl ? (
          <Image
            source={{ uri: line.imageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
          />
        ) : null}
      </PressableLink>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.bodyMedium }}>
          {line.productTitle}
        </Text>
        <Text variant="small" muted>
          {line.variantTitle || options}
        </Text>
        {line.releaseDate ? (
          // Pre-orders (p10-30).
          <Text variant="small" tone="signal" style={{ fontFamily: fonts.bodyBold }}>
            {tpo('cartLine', { date: calendarDay(line.releaseDate, locale) })}
          </Text>
        ) : null}
        {line.regularPriceCents ? (
          <PlusChip
            label={`${tpl('plusPrice')} · −${money(
              (line.regularPriceCents - line.unitPriceCents) * line.quantity,
            )}`}
          />
        ) : null}
        {line.problem === 'UNAVAILABLE' ? (
          <Text variant="small" tone="error">
            {t('lineUnavailable')}
          </Text>
        ) : line.problem === 'INSUFFICIENT_STOCK' ? (
          <Text variant="small" tone="error">
            {tc('lowStock', { count: line.available })}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 17 }}>
            {money(line.lineTotalCents)}
          </Text>
          {line.compareAtCents && line.compareAtCents > line.unitPriceCents ? (
            <Text variant="small" muted style={{ textDecorationLine: 'line-through' }}>
              {money(line.compareAtCents * line.quantity)}
            </Text>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <QuantityStepper
            value={line.quantity}
            max={Math.max(line.available, line.quantity)}
            disabled={busy}
            onChange={onQuantity}
            label={tc('quantityOf', { title: line.productTitle })}
          />
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            {onSave ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${ts('saveForLater')}: ${line.productTitle}`}
                disabled={busy}
                onPress={onSave}
                style={[styles.icon, { backgroundColor: p.bg }]}
              >
                <Ionicons name="bookmark-outline" size={18} color={p.fg} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${tu('remove')}: ${line.productTitle}`}
              disabled={busy}
              onPress={() => onQuantity(0)}
              style={[styles.icon, { backgroundColor: p.bg }]}
            >
              <Ionicons name="trash-outline" size={18} color={p.fg} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius + 6 },
  thumb: { width: 92, height: 92, borderRadius: radius + 2, overflow: 'hidden', padding: 6 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
});
