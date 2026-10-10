import { errorMessage } from '@nixzora/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Share, Switch, View } from 'react-native';
import { listKeys } from '@/components/AddToListButton';
import { Price } from '@/components/Price';
import { PressableLink } from '@/components/PressableLink';
import { Banner, Button, Card, Divider, EmptyState, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { radius, space, usePalette } from '@/lib/theme';

/** One list or registry: its items, sharing by private link, and settings (p10-08). */
export default function ListScreen() {
  const p = usePalette();
  const t = useT('lists');
  const tc = useT('common');
  const { shortDate } = useFormatters();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const list = useQuery({ queryKey: listKeys.one(id), queryFn: () => api.account.list(id) });
  const refresh = () => void client.invalidateQueries({ queryKey: listKeys.all });

  const share = useMutation({
    mutationFn: (isShared: boolean) => api.account.updateList(id, { isShared }),
    onSuccess: refresh,
  });
  const reset = useMutation({
    mutationFn: () => api.account.resetListLink(id),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (productId: string) => api.account.removeFromList(id, productId),
    onSuccess: refresh,
  });
  const destroy = useMutation({
    mutationFn: () => api.account.deleteList(id),
    onSuccess: () => {
      refresh();
      router.back();
    },
  });

  if (list.isLoading) return <ActivityIndicator style={{ flex: 1, backgroundColor: p.bg }} />;
  if (!list.data) {
    return (
      <Screen>
        <EmptyState
          title={t('notFound')}
          body={list.error ? errorMessage(list.error) : undefined}
        />
      </Screen>
    );
  }
  const data = list.data;
  const url = `${WEB_URL}/lists/${data.shareToken}`;
  const problem = share.error ?? reset.error ?? remove.error ?? destroy.error;

  return (
    <Screen>
      <Stack.Screen options={{ title: data.name }} />
      <Text muted>
        {[
          t(`kind_${data.kind}`),
          t('itemCount', { count: data.itemCount }),
          data.eventDate ? t('eventOn', { date: shortDate(`${data.eventDate}T12:00:00`) }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {problem ? <Banner tone="error">{errorMessage(problem)}</Banner> : null}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ flex: 1 }}>{t('sharedLabel')}</Text>
          <Switch
            value={data.isShared}
            onValueChange={(next) => share.mutate(next)}
            disabled={share.isPending}
            accessibilityLabel={t('sharedLabel')}
          />
        </Row>
        <Text variant="small" muted>
          {data.isShared ? t('shareHint') : t('shareOff')}
        </Text>
        {data.isShared ? (
          <Row style={{ gap: space.sm }}>
            <Button
              title={t('shareTitle')}
              tone="secondary"
              style={{ flex: 1 }}
              onPress={() => void Share.share({ message: `${data.name}\n${url}`, url })}
            />
            <Button
              title={t('resetLink')}
              tone="ghost"
              loading={reset.isPending}
              onPress={() => reset.mutate()}
            />
          </Row>
        ) : null}
      </Card>

      {data.items.length ? (
        data.items.map((item) => (
          <View key={item.product.id} style={{ gap: space.sm }}>
            <PressableLink
              href={`/p/${item.product.slug}`}
              accessibilityRole="link"
              style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}
            >
              {item.product.image ? (
                <Image
                  source={{ uri: item.product.image.url }}
                  style={{ width: 72, height: 72, borderRadius: radius, backgroundColor: p.card }}
                  contentFit="contain"
                />
              ) : null}
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2}>{item.product.title}</Text>
                <Price
                  cents={item.product.priceFromCents}
                  compareAtCents={item.product.compareAtCents}
                  currency={item.product.currency}
                />
                {item.quantity > 1 ? (
                  <Text variant="small" muted>
                    {t('wantQty', { count: item.quantity })}
                  </Text>
                ) : null}
              </View>
            </PressableLink>
            <Button
              title={t('remove')}
              tone="ghost"
              disabled={remove.isPending}
              onPress={() => remove.mutate(item.product.id)}
            />
            <Divider />
          </View>
        ))
      ) : (
        <Text muted>{t('empty')}</Text>
      )}

      <Button
        title={t('deleteList')}
        tone="danger"
        loading={destroy.isPending}
        onPress={() =>
          Alert.alert(t('deleteList'), data.name, [
            { text: tc('cancel'), style: 'cancel' },
            { text: tc('delete'), style: 'destructive', onPress: () => destroy.mutate() },
          ])
        }
      />
    </Screen>
  );
}
