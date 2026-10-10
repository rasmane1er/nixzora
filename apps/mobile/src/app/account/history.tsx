import { errorMessage } from '@nixzora/api-client';
import type { BrowsingHistory } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, RefreshControl, View } from 'react-native';
import { Banner, Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';
import { visitorId } from '@/lib/visitor';

const historyKey = ['browsing-history'] as const;

/**
 * Browsing history (p10-19): products looked at while signed in, the price then and now, a
 * price-drop alert per item, and forgetting one or all of them.
 */
export default function HistoryScreen() {
  const t = useT('history');
  const tc = useT('common');
  const p = usePalette();
  const { money, shortDate } = useFormatters();
  const client = useQueryClient();
  const history = useQuery({ queryKey: historyKey, queryFn: () => api.account.history() });
  const patch = (fn: (h: BrowsingHistory) => BrowsingHistory) =>
    client.setQueryData<BrowsingHistory>(historyKey, (h) => (h ? fn(h) : h));

  const alert = useMutation({
    mutationFn: ({ productId, on }: { productId: string; on: boolean }) =>
      api.account.setAlert(productId, 'PRICE_DROP', on),
    onMutate: ({ productId, on }) =>
      patch((h) => ({
        ...h,
        items: h.items.map((i) => (i.product.id === productId ? { ...i, alertOn: on } : i)),
      })),
    onError: () => void client.invalidateQueries({ queryKey: historyKey }),
  });
  const remove = useMutation({
    mutationFn: (productId: string) => api.account.forgetViewed(productId),
    onMutate: (productId) =>
      patch((h) => ({ ...h, items: h.items.filter((i) => i.product.id !== productId) })),
    onError: () => void client.invalidateQueries({ queryKey: historyKey }),
  });
  const clear = useMutation({
    mutationFn: async () => api.recommendations.clearHistory(await visitorId()),
    onSuccess: () => {
      patch((h) => ({ ...h, items: [] }));
      void client.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });
  const confirmClear = () => {
    if (Platform.OS === 'web') {
      clear.mutate();
      return;
    }
    Alert.alert(t('clearAll'), t('clearConfirm'), [
      { text: tc('cancel'), style: 'cancel' },
      { text: t('clearAll'), style: 'destructive', onPress: () => clear.mutate() },
    ]);
  };

  const data = history.data;
  const problem = history.error ?? alert.error ?? remove.error ?? clear.error;
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={history.isRefetching}
          onRefresh={() => void history.refetch()}
        />
      }
    >
      {problem ? <Banner tone="error">{errorMessage(problem)}</Banner> : null}
      {clear.isSuccess ? <Banner tone="ok">{t('cleared')}</Banner> : null}
      <Text muted>{t('lead')}</Text>
      {data?.paused ? (
        <Banner tone="warn">
          {t('paused')}{' '}
          <Text
            tone="signal"
            style={{ fontFamily: fonts.bodyBold }}
            onPress={() => router.push('/account/preferences')}
          >
            {t('preferences')}
          </Text>
        </Banner>
      ) : null}
      {data && data.items.length === 0 ? <EmptyState title={t('none')} /> : null}
      {data?.items.map(({ product, viewedAt, droppedCents, alertOn }) => (
        <Card key={product.id} style={{ flexDirection: 'row', gap: space.md }}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={product.title}
            onPress={() => router.push(`/p/${product.slug}`)}
          >
            <Image
              source={product.image ? { uri: product.image.url } : undefined}
              alt=""
              style={{ width: 76, height: 76, borderRadius: 10, backgroundColor: p.line }}
              contentFit="cover"
            />
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Pressable accessibilityRole="link" onPress={() => router.push(`/p/${product.slug}`)}>
              <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }} numberOfLines={2}>
                {product.title}
              </Text>
            </Pressable>
            <Text style={{ color: p.fg }}>{money(product.priceFromCents, product.currency)}</Text>
            {droppedCents > 0 ? (
              <Text variant="small" style={{ color: p.okFg, fontFamily: fonts.bodyBold }}>
                {t('droppedSince', { amount: money(droppedCents, product.currency) })}
              </Text>
            ) : null}
            <Text variant="small" muted>
              {t('viewed', { date: shortDate(viewedAt) })}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: 4 }}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: alertOn }}
                onPress={() => alert.mutate({ productId: product.id, on: !alertOn })}
              >
                <Text tone="signal" style={{ fontFamily: fonts.bodyBold }}>
                  {alertOn ? `✓ ${t('alertOn')}` : t('alertMe')}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => remove.mutate(product.id)}>
                <Text muted>{t('remove')}</Text>
              </Pressable>
            </View>
          </View>
        </Card>
      ))}
      {data?.items.length ? (
        <Button
          title={t('clearAll')}
          tone="secondary"
          loading={clear.isPending}
          onPress={confirmClear}
        />
      ) : null}
    </Screen>
  );
}
