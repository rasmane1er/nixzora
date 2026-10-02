import type { Cart, ProductListQuery } from '@nixzora/validation';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { keys } from './query';
import { useSession } from './session';

export function useCart() {
  const { status } = useSession();
  return useQuery({
    queryKey: keys.cart,
    queryFn: () => api.cart.get(),
    enabled: status !== 'loading' && status !== 'locked',
    staleTime: 15_000,
  });
}

/** Cart writes return the new cart; it replaces the cached one. */
export function useCartMutation<Args>(fn: (args: Args) => Promise<Cart>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => client.setQueryData(keys.cart, cart),
  });
}

export function useWishlistIds() {
  const { status } = useSession();
  return useQuery({
    queryKey: keys.wishlistIds,
    queryFn: () => api.account.wishlistIds(),
    enabled: status === 'signedIn',
  });
}

export function useToggleWish() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, wished }: { productId: string; wished: boolean }) =>
      wished ? api.account.unwish(productId) : api.account.wish(productId),
    onMutate: async ({ productId, wished }) => {
      await client.cancelQueries({ queryKey: keys.wishlistIds });
      const before = client.getQueryData<string[]>(keys.wishlistIds) ?? [];
      client.setQueryData(
        keys.wishlistIds,
        wished ? before.filter((id) => id !== productId) : [...before, productId],
      );
      return { before };
    },
    onError: (_error, _vars, context) => client.setQueryData(keys.wishlistIds, context?.before),
    onSettled: () => client.invalidateQueries({ queryKey: keys.wishlist }),
  });
}

/** Paged catalog listing for search and category screens (cached for offline use). */
export function useProductList(query: Partial<ProductListQuery>) {
  return useInfiniteQuery({
    queryKey: keys.products(query),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.catalog.products({ pageSize: 20, ...query, page: pageParam }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.catalog.categories(),
    staleTime: 10 * 60_000,
  });
}
