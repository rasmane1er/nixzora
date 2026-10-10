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
  const pl = useT('plus');
  const bd = useT('bundles');
  // NIXZORA Plus (p10-15): the API marks a member's totals with the shipping it waived.
  const member = totals.shippingWaivedCents !== undefined;
  const c = totals.currency;
  return (
    <View style={{ gap: space.sm }}>
      <Line label={to('subtotal')} value={money(totals.subtotalCents, c)} />
      {totals.bundleDiscountCents ? (
        <Line label={bd('savings')} value={`−${money(totals.bundleDiscountCents, c)}`} tone="ok" />
      ) : null}
      {totals.discountCents - (totals.bundleDiscountCents ?? 0) ? (
        <Line
          label={to('discount')}
          value={`−${money(totals.discountCents - (totals.bundleDiscountCents ?? 0), c)}`}
          tone="ok"
        />
      ) : null}
      <Line
        label={to('shipping')}
        value={
          member
            ? pl('freeWithPlus')
            : totals.shippingCents
              ? money(totals.shippingCents, c)
              : to('free')
        }
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
