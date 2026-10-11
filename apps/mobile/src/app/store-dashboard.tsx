import { errorMessage } from '@nixzora/api-client';
import type { SellerAnalytics } from '@nixzora/validation';
import { calendarDay } from '@nixzora/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, RefreshControl, useColorScheme, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Banner, Button, Card, Divider, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { useFormatters } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';

type Days = '7' | '30' | '90';
const CHART_H = 120;

/** A thin horizontal bar, sized against the largest value in its list. */
function Bar({ value, max }: { value: number; max: number }) {
  const p = usePalette();
  const dark = useColorScheme() === 'dark';
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: p.line, overflow: 'hidden' }}>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          width: `${max ? Math.min(100, Math.max(2, (value / max) * 100)) : 0}%`,
          backgroundColor: dark ? '#E8622C' : '#C2410C',
        }}
      />
    </View>
  );
}

/** Daily sales as columns: tap one for its day and amount; the list below is the table view. */
function DailySales({ daily }: { daily: SellerAnalytics['daily'] }) {
  const p = usePalette();
  const st = useT('sellerTools');
  const sv = useT('storeStats');
  const dark = useColorScheme() === 'dark';
  const { money } = useFormatters();
  const [picked, setPicked] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...daily.map((d) => d.salesCents));
  const day = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  const shown = picked === null ? null : daily[picked];
  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="heading">{st('dailySales')}</Text>
      <Text variant="small" muted>
        {shown ? `${day(shown.date)} · ${money(shown.salesCents)}` : ' '}
      </Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${st('dailySales')}: ${money(daily.reduce((s, d) => s + d.salesCents, 0))}`}
        style={{ height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}
      >
        {daily.map((d, i) => (
          <Pressable
            key={d.date}
            onPress={() => setPicked(picked === i ? null : i)}
            style={{ flex: 1, height: CHART_H, justifyContent: 'flex-end' }}
          >
            <View
              style={{
                height: Math.max(d.salesCents ? 3 : 1, (d.salesCents / max) * CHART_H),
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
                backgroundColor: d.salesCents
                  ? picked === i
                    ? p.fg
                    : dark
                      ? '#E8622C'
                      : '#C2410C'
                  : p.line,
              }}
            />
          </Pressable>
        ))}
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="small" muted>
          {daily[0] ? day(daily[0].date) : ''}
        </Text>
        <Text variant="small" muted>
          {daily.at(-1) ? day(daily.at(-1)!.date) : ''}
        </Text>
      </Row>
      <Pressable accessibilityRole="button" onPress={() => setTable(!table)}>
        <Text muted>
          {table ? '▾' : '▸'} {sv('tableView')}
        </Text>
      </Pressable>
      {table
        ? daily
            .filter((d) => d.salesCents)
            .map((d) => (
              <Row key={d.date} style={{ justifyContent: 'space-between' }}>
                <Text muted>{day(d.date)}</Text>
                <Text style={{ color: p.fg }}>
                  {money(d.salesCents)} · {d.orders}
                </Text>
              </Row>
            ))
        : null}
    </Card>
  );
}

/**
 * Store analytics in the app (p10-25): the same figures as the web's seller analytics, for the
 * store's team. Everything else about running the store stays on the web.
 */
export default function StoreDashboardScreen() {
  const st = useT('sellerTools');
  const sv = useT('storeStats');
  const p = usePalette();
  const { money, percent } = useFormatters();
  const [days, setDays] = useState<Days>('30');
  const stats = useQuery({
    queryKey: ['seller-analytics', days],
    queryFn: () => api.seller.analytics(Number(days) as 7 | 30 | 90),
  });
  const s = stats.data;
  // Vacation mode (p10-32): whether the store is away, and a quick way back.
  const client = useQueryClient();
  const tv = useT('vacation');
  const locale = useLocale();
  const me = useQuery({ queryKey: ['seller-me'], queryFn: () => api.seller.me() });
  const back = useMutation({
    mutationFn: () => api.seller.endVacation(),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['seller-me'] }),
  });
  const store = me.data?.seller;
  const tiles: [string, string][] = s
    ? [
        [st('tileSales'), money(s.totals.salesCents)],
        [st('tileEarned'), money(s.totals.netCents)],
        [st('tileOrders'), String(s.totals.orders)],
        [st('tileViews'), String(s.totals.views)],
      ]
    : [];
  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={stats.isRefetching} onRefresh={() => void stats.refetch()} />
      }
    >
      {store ? (
        <Card style={{ gap: space.sm }}>
          <Text variant="heading">{tv('title')}</Text>
          <Text variant="small" muted={!store.away}>
            {store.away
              ? store.away.until
                ? tv('statusAway', { date: calendarDay(store.away.until, locale) })
                : tv('statusAwayOpen')
              : store.vacation
                ? tv('statusScheduled', { from: calendarDay(store.vacation.from, locale) })
                : tv('lead')}
          </Text>
          {back.error ? <Banner tone="error">{errorMessage(back.error)}</Banner> : null}
          {store.vacation ? (
            <Button title={tv('end')} loading={back.isPending} onPress={() => back.mutate()} />
          ) : (
            <Button
              tone="secondary"
              title={tv('start')}
              onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/sell/settings#vacation`)}
            />
          )}
        </Card>
      ) : null}
      <Chips<Days>
        value={days}
        onChange={setDays}
        options={(['7', '30', '90'] as const).map((d) => ({
          value: d,
          label: st('lastDays', { days: Number(d) }),
        }))}
      />
      {stats.error ? <Banner tone="error">{errorMessage(stats.error)}</Banner> : null}
      {s ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {tiles.map(([label, value]) => (
              <Card key={label} style={{ flexBasis: '47%', flexGrow: 1, gap: 2 }}>
                <Text variant="small" muted>
                  {label}
                </Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 22, color: p.fg }}>
                  {value}
                </Text>
              </Card>
            ))}
          </View>

          <DailySales daily={s.daily} />

          {s.funnel ? (
            <Card style={{ gap: space.md }}>
              <Text variant="heading">{sv('funnelTitle')}</Text>
              {(
                [
                  ['funnelViews', s.funnel.views],
                  ['funnelCarts', s.funnel.carts],
                  ['funnelOrders', s.funnel.orders],
                ] as const
              ).map(([label, value], i, steps) => {
                const prev = i ? steps[i - 1]![1] : 0;
                return (
                  <View key={label} style={{ gap: 4 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Text>{sv(label)}</Text>
                      <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }}>{value}</Text>
                    </Row>
                    <Bar value={value} max={steps[0]![1]} />
                    {i && prev && value <= prev ? (
                      <Text variant="small" muted>
                        {sv('funnelRate', { rate: percent(value / prev) })}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          ) : null}

          {s.sources ? (
            <Card style={{ gap: space.md }}>
              <Text variant="heading">{sv('sourcesTitle')}</Text>
              {s.sources.length ? (
                s.sources.map((row) => {
                  const total = s.sources!.reduce((sum, r) => sum + r.views, 0);
                  return (
                    <View key={row.source} style={{ gap: 4 }}>
                      <Row style={{ justifyContent: 'space-between', gap: space.sm }}>
                        <Text style={{ flex: 1 }}>{sv(`source_${row.source}`)}</Text>
                        <Text variant="small" muted>
                          {row.views} · {percent(row.views / total)}
                        </Text>
                      </Row>
                      <Bar value={row.views} max={s.sources![0]!.views} />
                    </View>
                  );
                })
              ) : (
                <Text muted>{sv('sourcesEmpty')}</Text>
              )}
            </Card>
          ) : null}

          {s.followers ? (
            <Card style={{ gap: 2 }}>
              <Text variant="heading">{sv('followersTitle')}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 28, color: p.fg }}>
                {s.followers.total}
              </Text>
              <Text variant="small" muted>
                {sv('followersNew', { count: s.followers.new, days: Number(days) })}
              </Text>
            </Card>
          ) : null}

          <Card style={{ gap: space.xs }}>
            <Text variant="heading">{st('topProducts')}</Text>
            {s.topProducts.length ? (
              s.topProducts.map((row, i) => (
                <View key={row.productId}>
                  {i ? <Divider /> : null}
                  <View style={{ paddingVertical: space.sm, gap: 2 }}>
                    <Text style={{ fontFamily: fonts.bodyMedium, color: p.fg }} numberOfLines={2}>
                      {row.title}
                    </Text>
                    <Text variant="small" muted>
                      {st('colViews')} {row.views} · {sv('colCarts')} {row.carts ?? 0} ·{' '}
                      {st('colUnits')} {row.units} · {money(row.salesCents)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text muted>{st('noTopProducts')}</Text>
            )}
          </Card>

          <Text variant="small" muted>
            {sv('appMore')}
          </Text>
          <Button
            tone="secondary"
            title={sv('openWeb')}
            onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/sell/analytics`)}
          />
        </>
      ) : null}
    </Screen>
  );
}
