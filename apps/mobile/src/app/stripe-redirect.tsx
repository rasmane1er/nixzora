import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Return address for bank verification pages (3-D Secure) opened by the payment sheet. Stripe
 * handles the URL itself (lib/payments.ts); this screen only steps back to checkout.
 */
export default function StripeRedirect() {
  const back = router.canGoBack();
  useEffect(() => {
    if (back) router.back();
  }, [back]);
  return back ? null : <Redirect href="/cart" />;
}
