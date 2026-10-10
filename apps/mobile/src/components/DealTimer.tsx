import type { ProductCard } from '@nixzora/validation';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { palettes, usePalette } from '@/lib/theme';
import { Text } from './ui';

export const DEAL_RED = '#B3261E';

/** "3:07:15": what is left of a deal (hours may pass 24 for day deals). */
export function remaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** The badge text: "Lightning deal · 30% off". */
export function useDealLabel() {
  const t = useT('deals');
  const { percent } = useFormatters();
  return (deal: NonNullable<ProductCard['deal']>) =>
    `${t(deal.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')} · ${t('percentOff', {
      percent: percent(deal.percentOff / 100),
    })}`;
}

/** A live deal's countdown and, for limited lightning deals, how much is claimed (p10-07). */
export function DealTimer({ deal }: { deal: NonNullable<ProductCard['deal']> }) {
  const t = useT('deals');
  const p = usePalette();
  const { percent, shortDate } = useFormatters();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Date.parse(deal.endsAt) - now;
  const claimed = deal.kind === 'LIGHTNING' ? deal.claimedPercent : null;
  return (
    <View style={{ gap: 4 }}>
      <Text
        variant="small"
        style={{ color: p === palettes.dark ? '#FF8A80' : DEAL_RED, fontVariant: ['tabular-nums'] }}
      >
        {left <= 0
          ? t('ended')
          : left > 48 * 3_600_000
            ? t('endsOn', { date: shortDate(deal.endsAt) })
            : t('endsIn', { time: remaining(left) })}
      </Text>
      {claimed != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: p.line, maxWidth: 90 }}
          >
            <View
              style={{
                width: `${Math.min(100, claimed)}%`,
                height: 5,
                borderRadius: 3,
                backgroundColor: DEAL_RED,
              }}
            />
          </View>
          <Text variant="small" muted style={{ fontSize: 11 }}>
            {t('claimed', { percent: percent(claimed / 100) })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
