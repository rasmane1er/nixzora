import type { AuthTokens } from '@nixzora/validation';
import { api } from './api';
import { queryClient } from './query';
import { enablePush, forgetDevice } from './push';
import { session } from './session';

/** After any sign-in: keep what the guest put in the cart, and re-register for pushes. */
export async function completeSignIn(tokens: AuthTokens): Promise<void> {
  await session.signIn(tokens);
  const guestCart = session.cartId();
  if (guestCart) {
    await api.cart.merge(guestCart).catch(() => undefined);
    session.setCartId(null);
  }
  await queryClient.invalidateQueries({ queryKey: ['cart'] });
  void enablePush(false).catch(() => undefined);
}

export async function signOut(options: { serverEnded?: boolean } = {}): Promise<void> {
  await session.signOut(forgetDevice, options.serverEnded);
  // Drop everything that belonged to the account; the catalog cache stays. The cart is reset
  // (not just removed) so the tab badge refetches as a guest right away.
  for (const key of ['orders', 'wishlist', 'addresses']) {
    queryClient.removeQueries({ queryKey: [key] });
  }
  await queryClient.resetQueries({ queryKey: ['cart'] });
}
