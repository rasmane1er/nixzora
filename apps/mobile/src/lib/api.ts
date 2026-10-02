import { createApiClient } from '@nixzora/api-client';
import { Platform } from 'react-native';
import { API_URL, APP_VERSION } from './config';
import { session } from './session';

/** The app's API client: sends the access token, refreshes it when it expires. */
export const api = createApiClient({
  baseUrl: API_URL,
  clientName: `nixzora-${Platform.OS}/${APP_VERSION}`,
  session: {
    accessToken: session.accessToken,
    refresh: session.refresh,
    cartId: session.cartId,
    onCartId: (id) => {
      if (id !== session.cartId()) session.setCartId(id);
    },
  },
});
