import type { CartLine } from '@nixzora/validation';
import { PressableLink } from './PressableLink';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { optionsText, useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';
import { QuantityStepper } from './QuantityStepper';
import { Text } from './ui';

export function CartLineRow({
  line,
  busy,
  onQuantity,
}: {
  line: CartLine;
  busy?: boolean;
  onQuantity: (quantity: number) => void;
}) {
  const p = usePalette();
  const { money } = useFormatters();
  const t = useT('appShop');
  const tc = useT('cart');
  const options = optionsText(line.options);
  return (
    <View style={styles.row}>
      <PressableLink
        href={`/p/${line.productSlug}?variant=${line.variantId}`}
        accessibilityLabel={line.productTitle}
        style={[styles.thumb, { backgroundColor: p.card, borderColor: p.line }]}
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
        {line.problem === 'UNAVAILABLE' ? (
          <Text variant="small" tone="error">
            {t('lineUnavailable')}
          </Text>
        ) : line.problem === 'INSUFFICIENT_STOCK' ? (
          <Text variant="small" tone="error">
            {tc('lowStock', { count: line.available })}
          </Text>
        ) : null}
        <View style={styles.bottom}>
          <QuantityStepper
            value={line.quantity}
            max={Math.max(line.available, line.quantity)}
            disabled={busy}
            onChange={onQuantity}
            label={tc('quantityOf', { title: line.productTitle })}
          />
          <Text style={{ fontFamily: fonts.displayMedium }}>{money(line.lineTotalCents)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  thumb: { width: 76, height: 76, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
});
