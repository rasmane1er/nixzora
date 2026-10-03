import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { type PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { ApiError } from '@nixzora/api-client';
import { AppState, Platform } from 'react-native';

/** Catalog data survives restarts so the app can be browsed offline (up to a week old). */
const CATALOG_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: CATALOG_MAX_AGE,
      retry: (failures, error) =>
        failures < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      // Show cached catalog pages while offline instead of pausing on an empty screen.
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'online' },
  },
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: 'nixzora.queryCache' }),
  maxAge: CATALOG_MAX_AGE,
  // Bump when cached shapes change, so old caches are dropped instead of misread.
  buster: 'catalog-v1',
  dehydrateOptions: {
    // Only public catalog data goes to disk; carts, orders and account data never do.
    shouldDehydrateQuery: (query) =>
      query.queryKey[0] === 'catalog' && query.state.status === 'success',
  },
};

/** React Query learns about connectivity from NetInfo and about focus from AppState. */
export function connectQueryToDevice(): () => void {
  const offNet = NetInfo.addEventListener((net) => {
    onlineManager.setOnline(net.isConnected !== false && net.isInternetReachable !== false);
  });
  if (Platform.OS === 'web') return offNet;
  const appState = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
  return () => {
    offNet();
    appState.remove();
  };
}

/** Query keys in one place, so screens invalidate the same things they read. */
export const keys = {
  categories: ['catalog', 'categories'] as const,
  products: (query: Record<string, unknown>) => ['catalog', 'products', query] as const,
  product: (slug: string) => ['catalog', 'product', slug] as const,
  cart: ['cart'] as const,
  orders: ['orders'] as const,
  order: (number: string) => ['orders', number] as const,
  wishlist: ['wishlist'] as const,
  wishlistIds: ['wishlist', 'ids'] as const,
  addresses: ['addresses'] as const,
  overview: ['me', 'overview'] as const,
  orderHistory: (filter: string) => ['me', 'order-history', filter] as const,
  buyAgain: ['me', 'buy-again'] as const,
  returns: ['me', 'returns'] as const,
  reviews: ['me', 'reviews'] as const,
  preferences: ['me', 'preferences'] as const,
  sessions: ['me', 'sessions'] as const,
  profile: ['me', 'profile'] as const,
};
