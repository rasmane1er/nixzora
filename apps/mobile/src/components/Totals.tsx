import type { Totals as TotalsView } from '@nixzora/validation';
import { View } from 'react-native';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space } from '@/lib/theme';
import { Divider, Row, Text } from './ui';

function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'ok';
}) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text variant={strong ? 'heading' : 'body'} muted={!strong}>
        {label}
      </Text>
      <Text
        tone={tone}
        variant={strong ? 'heading' : 'body'}
        style={{ fontFamily: strong ? fonts.display : fonts.bodyMedium }}
      >
        {value}
      </Text>
    </Row>
  );
}

export function Totals({ totals, taxKnown = true }: { totals: TotalsView; taxKnown?: boolean }) {
  const { money } = useFormatters();
  const t = useT('appShop');
  const to = useT('order');
  const tc = useT('cart');
  const c = totals.currency;
  return (
    <View style={{ gap: space.sm }}>
      <Line label={to('subtotal')} value={money(totals.subtotalCents, c)} />
      {totals.discountCents ? (
        <Line label={to('discount')} value={`−${money(totals.discountCents, c)}`} tone="ok" />
      ) : null}
      <Line
        label={to('shipping')}
        value={totals.shippingCents ? money(totals.shippingCents, c) : to('free')}
      />
      <Line label={to('tax')} value={taxKnown ? money(totals.taxCents, c) : tc('atCheckout')} />
      <Divider />
      <Line label={to('total')} value={money(totals.totalCents, c)} strong />
      {totals.freeShippingRemainingCents > 0 ? (
        <Text variant="small" muted>
          {t('addMoreForFreeShipping', { amount: money(totals.freeShippingRemainingCents, c) })}
        </Text>
      ) : null}
    </View>
  );
}
