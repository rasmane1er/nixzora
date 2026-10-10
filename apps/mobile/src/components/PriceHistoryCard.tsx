import { INTL_LOCALE } from '@nixzora/i18n';
import { PRICE_HISTORY_RANGES, type PriceHistory } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, useColorScheme, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Card, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';

type Range = `${(typeof PRICE_HISTORY_RANGES)[number]}`;
const H = 150;
const AXIS = 58;
const LINE = 2;

const priceHistoryKey = (slug: string, days: number) => ['price-history', slug, days] as const;

/** One query for both the card and the badge, so the 90-day history loads once. */
function usePriceHistory(slug: string, days: number) {
  return useQuery({
    queryKey: priceHistoryKey(slug, days),
    queryFn: () => api.catalog.priceHistory(slug, days),
    staleTime: 5 * 60_000,
  });
}

/** "Lowest price in 30 days" under the price (p10-19), when it is. */
export function LowestPriceBadge({ slug }: { slug: string }) {
  const t = useT('history');
  const p = usePalette();
  const history = usePriceHistory(slug, 90);
  if (!history.data?.lowestIn30Days) return null;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: p.okBg,
        borderRadius: 6,
        paddingHorizontal: space.sm,
        paddingVertical: 3,
      }}
    >
      <Text variant="small" style={{ color: p.okFg, fontFamily: fonts.bodyBold }}>
        {t('lowestIn30')}
      </Text>
    </View>
  );
}

/**
 * Price history on a product (p10-19): range chips, today / lowest / typical / highest, and a
 * step chart drawn with plain views (tap or drag for the price on a day), plus the changes as a
 * list for screen readers and anyone who prefers numbers.
 */
export function PriceHistoryCard({ slug }: { slug: string }) {
  const t = useT('history');
  const [range, setRange] = useState<Range>('90');
  const history = usePriceHistory(slug, Number(range));
  const data = history.data;
  if (!data) return null;
  return (
    <Card style={{ gap: space.md }}>
      <Text variant="heading">{t('priceTitle')}</Text>
      <Chips<Range>
        value={range}
        onChange={setRange}
        options={PRICE_HISTORY_RANGES.map((days) => ({
          value: `${days}` as Range,
          label: t(`range_${days}`),
        }))}
      />
      {data.changed ? (
        <ChartBody history={data} />
      ) : (
        <Text muted>{t('steady', { days: data.days })}</Text>
      )}
    </Card>
  );
}

function ChartBody({ history }: { history: PriceHistory }) {
  const t = useT('history');
  const p = usePalette();
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E8622C' : '#C2410C';
  const { money, shortDate, locale } = useFormatters();
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const cur = history.currency;
  const fmt = (cents: number) => money(cents, cur);
  const day = (ms: number) =>
    new Date(ms).toLocaleDateString(INTL_LOCALE[locale], { month: 'short', day: 'numeric' });

  const start = Date.parse(history.points[0]!.at);
  const end = Date.parse(history.asOf);
  const lo = history.lowestCents;
  const hi = history.highestCents;
  const pad = Math.max(1, Math.round((hi - lo) * 0.15) || Math.round(hi * 0.05));
  const yMin = Math.max(0, lo - pad);
  const yMax = hi + pad;
  const plotW = Math.max(1, width - AXIS);
  const x = (ms: number) => ((ms - start) / Math.max(1, end - start)) * plotW;
  const y = (c: number) => (1 - (c - yMin) / Math.max(1, yMax - yMin)) * H;
  const steps = history.points.map((pt) => ({ t: Date.parse(pt.at), c: pt.priceCents }));
  const priceAt = (ms: number) => [...steps].reverse().find((s) => s.t <= ms)?.c ?? steps[0]!.c;
  const ticks = [yMax, (yMin + yMax) / 2, yMin].map((c) => Math.round(c));
  const pick = (px: number) =>
    setAt(Math.min(end, Math.max(start, start + (px / plotW) * (end - start))));

  const stats: [string, number][] = [
    [t('today'), history.currentCents],
    [t('lowest'), history.lowestCents],
    [t('typical'), history.typicalCents],
    [t('highest'), history.highestCents],
  ];
  const first = steps[0]!.c;

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm }}>
        {stats.map(([label, cents]) => (
          <View key={label} style={{ width: '50%', gap: 2 }}>
            <Text variant="small" muted>
              {label}
            </Text>
            <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }}>{fmt(cents)}</Text>
          </View>
        ))}
      </View>

      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('chartLabel', {
          days: history.days,
          first: fmt(first),
          last: fmt(history.currentCents),
          lowest: fmt(history.lowestCents),
        })}
      >
        {width ? (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: AXIS, height: H }}>
              {ticks.map((c) => (
                <Text
                  key={c}
                  variant="small"
                  muted
                  style={{ position: 'absolute', top: y(c) - 9, right: 8, fontSize: 11 }}
                >
                  {fmt(c)}
                </Text>
              ))}
            </View>
            <View
              style={{ width: plotW, height: H }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => true}
              onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
              onResponderMove={(e) => pick(e.nativeEvent.locationX)}
            >
              {ticks.map((c) => (
                <View
                  key={c}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: y(c),
                    height: 1,
                    backgroundColor: p.line,
                  }}
                />
              ))}
              {steps.map((s, i) => {
                const next = i + 1 < steps.length ? steps[i + 1]!.t : end;
                const left = x(s.t);
                const prev = i ? steps[i - 1]! : null;
                return (
                  <View key={s.t} pointerEvents="none">
                    <View
                      style={{
                        position: 'absolute',
                        left,
                        width: Math.max(LINE, x(next) - left),
                        top: y(s.c) - LINE / 2,
                        height: LINE,
                        backgroundColor: color,
                      }}
                    />
                    {prev ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: left - LINE / 2,
                          width: LINE,
                          top: Math.min(y(prev.c), y(s.c)) - LINE / 2,
                          height: Math.abs(y(prev.c) - y(s.c)) + LINE,
                          backgroundColor: color,
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: plotW - 4,
                  top: y(history.currentCents) - 4,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: color,
                }}
              />
              {at !== null ? (
                <>
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: x(at),
                      top: 0,
                      bottom: 0,
                      width: 1,
                      backgroundColor: p.muted,
                    }}
                  />
                  <View
                    pointerEvents="none"
                    accessibilityLiveRegion="polite"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: Math.min(Math.max(0, x(at) - 44), plotW - 88),
                      width: 88,
                      backgroundColor: p.card,
                      borderColor: p.line,
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingVertical: 4,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }}>
                      {fmt(priceAt(at))}
                    </Text>
                    <Text variant="small" muted>
                      {day(at)}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={{ height: H }} />
        )}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginLeft: AXIS,
            marginTop: 4,
          }}
        >
          <Text variant="small" muted>
            {day(start)}
          </Text>
          <Text variant="small" muted>
            {t('today')}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: table }}
        onPress={() => setTable(!table)}
      >
        <Text muted>
          {table ? '▾' : '▸'} {t('tableSummary')}
        </Text>
      </Pressable>
      {table ? (
        <View style={{ gap: 4 }}>
          {history.points.map((pt) => (
            <View key={pt.at} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text muted>{shortDate(pt.at)}</Text>
              <Text style={{ color: p.fg }}>{fmt(pt.priceCents)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
