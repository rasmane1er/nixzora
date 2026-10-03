import type { AuthTokens } from '@nixzora/validation';
import { api } from './api';
import { language } from './i18n';
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
  void syncLanguage();
}

/**
 * One language everywhere: a language chosen on this phone is saved on the account; otherwise
 * the account's language is used here.
 */
async function syncLanguage(): Promise<void> {
  try {
    if (language.isChosen()) {
      await api.me.setLanguage(language.get());
    } else {
      language.adopt((await api.me.profile()).language);
    }
  } catch {
    // A convenience: never block signing in.
  }
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
