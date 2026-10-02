import type { Totals as TotalsView } from '@nixzora/validation';
import { View } from 'react-native';
import { money } from '@/lib/format';
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
  const c = totals.currency;
  return (
    <View style={{ gap: space.sm }}>
      <Line label="Subtotal" value={money(totals.subtotalCents, c)} />
      {totals.discountCents ? (
        <Line label="Discount" value={`−${money(totals.discountCents, c)}`} tone="ok" />
      ) : null}
      <Line
        label="Shipping"
        value={totals.shippingCents ? money(totals.shippingCents, c) : 'Free'}
      />
      <Line label="Tax" value={taxKnown ? money(totals.taxCents, c) : 'At checkout'} />
      <Divider />
      <Line label="Total" value={money(totals.totalCents, c)} strong />
      {totals.freeShippingRemainingCents > 0 ? (
        <Text variant="small" muted>
          Add {money(totals.freeShippingRemainingCents, c)} more for free shipping.
        </Text>
      ) : null}
    </View>
  );
}
