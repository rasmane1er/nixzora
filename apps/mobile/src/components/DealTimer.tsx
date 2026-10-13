import { clockText, countdownPhase, type ProductCard } from '@nixzora/validation';
import { View } from 'react-native';
import { useNow } from '@/lib/clock';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, palettes, usePalette } from '@/lib/theme';
import { Text } from './ui';

export const DEAL_RED = '#B3261E';

/** "3:07:15": what is left of a deal. */
export const remaining = clockText;

/** The badge text: "Lightning deal · 30% off". */
export function useDealLabel() {
  const t = useT('deals');
  const pl = useT('plus');
  const { percent } = useFormatters();
  return (deal: NonNullable<ProductCard['deal']>) =>
    `${deal.plusOnly ? pl('plusPrice') : t(deal.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')} · ${t(
      'percentOff',
      {
        percent: percent(deal.percentOff / 100),
      },
    )}`;
}

/**
 * A live deal's countdown (p10-07) in its last 24 hours, "Ending soon" in the last hour,
 * otherwise its end date (p10-38); for limited lightning deals, how much is claimed. Ticks on
 * the app's shared clock.
 */
export function DealTimer({
  deal,
  dark = false,
}: {
  deal: NonNullable<ProductCard['deal']>;
  /** On the dark spotlight band (ADR-0061). */
  dark?: boolean;
}) {
  const t = useT('deals');
  const p = usePalette();
  const tc = useT('countdown');
  const { percent, shortDate } = useFormatters();
  const phase = countdownPhase(Date.parse(deal.endsAt), useNow(1000));
  const now = Date.now();
  const left = Date.parse(deal.endsAt) - now;
  const claimed = deal.kind === 'LIGHTNING' ? deal.claimedPercent : null;
  const red = dark ? '#F08A5D' : p === palettes.dark ? '#FF8A80' : DEAL_RED;
  return (
    <View style={{ gap: 4 }}>
      <Text variant="small" style={{ color: red, fontVariant: ['tabular-nums'] }}>
        {phase === 'ended'
          ? t('ended')
          : phase === 'later'
            ? t('endsOn', { date: shortDate(deal.endsAt) })
            : t('endsIn', { time: remaining(left) })}
        {phase === 'soon' ? (
          <Text
            variant="small"
            style={{
              fontFamily: fonts.bodyBold,
              color: red,
            }}
          >
            {` · ${tc('endingSoon')}`}
          </Text>
        ) : null}
      </Text>
      {claimed != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              backgroundColor: dark ? '#263244' : p.line,
              maxWidth: 90,
            }}
          >
            <View
              style={{
                width: `${Math.min(100, claimed)}%`,
                height: 5,
                borderRadius: 3,
                backgroundColor: dark ? '#F08A5D' : DEAL_RED,
              }}
            />
          </View>
          <Text variant="small" muted style={[{ fontSize: 11 }, dark && { color: '#B8C1CE' }]}>
            {t('claimed', { percent: percent(claimed / 100) })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
