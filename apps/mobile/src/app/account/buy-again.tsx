import { errorMessage } from '@nixzora/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { BuyAgainCard } from '@/components/BuyAgainCard';
import { Banner, Button, EmptyState, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useLayout } from '@/lib/layout';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { space } from '@/lib/theme';

/** Products from past orders, newest first, ready to add to the cart again. */
export default function BuyAgainScreen() {
  const { columns, width } = useLayout();
  const t = useT('appAccount');
  const items = useQuery({ queryKey: keys.buyAgain, queryFn: () => api.me.buyAgain() });
  const cols = Math.max(2, columns - 1);
  // Screen padding on both sides, and the gaps between cards.
  const cardWidth = Math.floor((width - space.lg * 2 - space.sm * (cols - 1)) / cols);

  return (
    <Screen
      wide
      refreshControl={
        <RefreshControl refreshing={items.isRefetching} onRefresh={() => void items.refetch()} />
      }
    >
      {items.error ? <Banner tone="error">{errorMessage(items.error)}</Banner> : null}
      {items.data && items.data.length === 0 ? (
        <EmptyState
          title={t('buyAgainEmptyTitle')}
          body={t('buyAgainEmptyBody')}
          action={<Button title={t('startShopping')} onPress={() => router.push('/')} />}
        />
      ) : null}
      {items.data?.length ? (
        <>
          <Text muted>{t('buyAgainIntro')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {items.data.map((item) => (
              <BuyAgainCard key={item.productId} item={item} width={cardWidth} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
