import { errorMessage } from '@nixzora/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ProductGrid } from '@/components/ProductGrid';
import { Banner, Button, EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';

export default function WishlistScreen() {
  const { status } = useSession();
  const t = useT('appShop');
  const wishlist = useQuery({
    queryKey: keys.wishlist,
    queryFn: () => api.account.wishlist(),
    enabled: status === 'signedIn',
  });

  return (
    <ProductGrid
      products={wishlist.data ?? []}
      refreshing={wishlist.isRefetching}
      onRefresh={() => void wishlist.refetch()}
      header={
        wishlist.error ? <Banner tone="error">{errorMessage(wishlist.error)}</Banner> : undefined
      }
      empty={
        wishlist.isLoading ? undefined : (
          <EmptyState
            title={t('nothingSaved')}
            body={t('tapHeart')}
            action={
              <Button title={t('browseShop')} tone="ghost" onPress={() => router.navigate('/')} />
            }
          />
        )
      }
    />
  );
}
