import { errorMessage } from '@nixzora/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ProductGrid } from '@/components/ProductGrid';
import { Banner, Button, EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';

export default function WishlistScreen() {
  const { status } = useSession();
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
            title="Nothing saved yet"
            body="Tap the heart on a product to keep it here."
            action={
              <Button title="Browse the shop" tone="ghost" onPress={() => router.navigate('/')} />
            }
          />
        )
      }
    />
  );
}
