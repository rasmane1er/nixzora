import { errorMessage } from '@nixzora/api-client';
import type { CartAndSaved, SavedItem } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';
import { PressableLink } from './PressableLink';
import { Banner, Button, Card, Divider, Text } from './ui';

export const savedKey = ['saved-for-later'] as const;

/** Saved for later (p10-21): the list, and moving items between it and the cart. */
export function useSaved() {
  const { status } = useSession();
  const client = useQueryClient();
  const signedIn = status === 'signedIn';
  const list = useQuery({
    queryKey: savedKey,
    queryFn: () => api.account.saved(),
    enabled: signedIn,
  });
  const both = (res: CartAndSaved) => {
    client.setQueryData(keys.cart, res.cart);
    client.setQueryData(savedKey, res.saved);
  };
  const save = useMutation({
    mutationFn: (variantId: string) => api.account.saveForLater(variantId),
    onSuccess: both,
  });
  const move = useMutation({
    mutationFn: (variantId: string) => api.account.moveSavedToCart(variantId),
    onSuccess: both,
  });
  const remove = useMutation({
    mutationFn: (variantId: string) => api.account.removeSaved(variantId),
    onSuccess: (saved: SavedItem[]) => client.setQueryData(savedKey, saved),
  });
  return { signedIn, list, save, move, remove };
}

export function SavedForLater({ saved }: { saved: ReturnType<typeof useSaved> }) {
  const t = useT('saved');
  const p = usePalette();
  const { money } = useFormatters();
  const items = saved.list.data ?? [];
  if (!items.length) return null;
  const busy = saved.move.isPending || saved.remove.isPending;
  const error = saved.move.error ?? saved.remove.error;
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="heading">{t('title', { count: items.length })}</Text>
      {error ? <Banner tone="error">{errorMessage(error)}</Banner> : null}
      <Card style={{ paddingVertical: space.xs }}>
        {items.map((item, i) => {
          const change = item.priceCents - item.savedPriceCents;
          return (
            <View key={item.variantId}>
              {i ? <Divider /> : null}
              <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md }}>
                <PressableLink
                  href={`/p/${item.productSlug}?variant=${item.variantId}`}
                  accessibilityLabel={item.productTitle}
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: p.line,
                    overflow: 'hidden',
                    backgroundColor: p.card,
                  }}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="contain"
                    />
                  ) : null}
                </PressableLink>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text numberOfLines={2} style={{ fontFamily: fonts.bodyMedium }}>
                    {item.productTitle}
                  </Text>
                  <Text variant="small" muted>
                    {item.variantTitle} · {t('qty', { count: item.quantity })}
                  </Text>
                  <Text style={{ fontFamily: fonts.displayMedium }}>
                    {money(item.priceCents, item.currency)}
                  </Text>
                  {change < 0 ? (
                    <Text variant="small" style={{ color: p.okFg, fontFamily: fonts.bodyBold }}>
                      {t('priceDown', { amount: money(-change, item.currency) })}
                    </Text>
                  ) : change > 0 ? (
                    <Text variant="small" muted>
                      {t('priceUp', { amount: money(change, item.currency) })}
                    </Text>
                  ) : null}
                  {item.problem ? (
                    <Text variant="small" tone="error">
                      {t('unavailable')}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                    {item.problem ? null : (
                      <Button
                        title={t('moveToCart')}
                        tone="secondary"
                        disabled={busy}
                        loading={saved.move.isPending && saved.move.variables === item.variantId}
                        onPress={() => saved.move.mutate(item.variantId)}
                      />
                    )}
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => saved.remove.mutate(item.variantId)}
                    >
                      <Text muted>{t('remove')}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </Card>
    </View>
  );
}
