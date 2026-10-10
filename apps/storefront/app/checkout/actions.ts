'use server';

import { type Cart, CartIdSchema, type CheckoutResponse, US_STATES } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { oneClickSetup } from '@/lib/one-click';
import { accessToken, guestCartId } from '@/lib/session';

export type CheckoutState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const FIELDS = [
  'email',
  'fullName',
  'line1',
  'line2',
  'city',
  'region',
  'postalCode',
  'phone',
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Buy now (p10-05): put just this item in its own cart and go straight to checkout. The
 * shopper's cart is left as it was.
 */
export async function buyNow(
  variantId: string,
  quantity: number,
  slug: string,
): Promise<{ error: string }> {
  if (!UUID.test(variantId)) return { error: (await getT('cart'))('chooseOption') };
  let cart: Cart;
  try {
    cart = await api<Cart>('/cart/buy-now', {
      method: 'POST',
      body: { variantId, quantity: Math.min(20, Math.max(1, Math.trunc(quantity) || 1)) },
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  const from = SLUG.test(slug) ? `&from=${slug}` : '';
  redirect(`/checkout?buy=${cart.cartId}${from}`);
}

/**
 * 1-click (p10-09): this item alone, to the default address, charged to the default saved card,
 * then straight to the order page (where it can still be cancelled for 30 minutes).
 */
export async function oneClickBuy(
  variantId: string,
  quantity: number,
  slug: string,
): Promise<{ error: string }> {
  if (!UUID.test(variantId)) return { error: (await getT('cart'))('chooseOption') };
  const setup = await oneClickSetup();
  if (!setup) return buyNow(variantId, quantity, slug);
  let checkout: CheckoutResponse;
  try {
    const cart = await api<Cart>('/cart/buy-now', {
      method: 'POST',
      body: { variantId, quantity: Math.min(20, Math.max(1, Math.trunc(quantity) || 1)) },
    });
    const a = setup.address;
    const address = {
      fullName: a.fullName,
      line1: a.line1,
      line2: a.line2 || undefined,
      city: a.city,
      region: a.region,
      postalCode: a.postalCode,
      country: a.country,
      phone: a.phone || undefined,
    };
    checkout = await api<CheckoutResponse>('/checkout', {
      method: 'POST',
      body: {
        buyNowId: cart.cartId,
        email: setup.email,
        shippingAddress: address,
        paymentCardId: setup.card.id,
        // Like a normal checkout: any gift card balance goes first (p10-10).
        useGiftBalance: true,
      },
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  redirect(afterCheckout(checkout));
}

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? '').trim()]));
  const signedIn = Boolean(await accessToken());
  const cartId = await guestCartId();
  const buy = CartIdSchema.safeParse(form.get('buyNowId'));
  const paymentCardId = String(form.get('paymentCardId') ?? '');
  const buyNowId = buy.success ? buy.data : null;
  const t = await getT('checkout');

  if (!(US_STATES as readonly string[]).includes(values.region ?? '')) {
    return { values, fieldErrors: { region: t('chooseState') } };
  }

  let checkout: CheckoutResponse;
  try {
    checkout = await api<CheckoutResponse>('/checkout', {
      method: 'POST',
      body: {
        ...(buyNowId ? { buyNowId } : signedIn || !cartId ? {} : { cartId }),
        email: values.email,
        saveAddress: signedIn && form.get('saveAddress') === 'on',
        // Saved cards (p10-09): pay now with one, or keep the new card for next time.
        ...(signedIn && UUID.test(paymentCardId) ? { paymentCardId } : {}),
        ...(signedIn && !paymentCardId && form.get('saveCard') === 'on' ? { saveCard: true } : {}),
        ...(signedIn && form.get('useGiftBalance') === 'on' ? { useGiftBalance: true } : {}),
        shippingAddress: {
          fullName: values.fullName,
          line1: values.line1,
          line2: values.line2 || undefined,
          city: values.city,
          region: values.region,
          postalCode: values.postalCode,
          country: 'US',
          phone: values.phone || undefined,
        },
      },
    });
  } catch (error) {
    if (
      !buyNowId &&
      error instanceof ApiError &&
      (error.code === 'CART_CHANGED' || error.code === 'COUPON_INVALID')
    ) {
      redirect(`/cart?error=${encodeURIComponent(error.message)}`);
    }
    if (error instanceof ApiError && error.issues.length) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        fieldErrors[issue.field.replace('shippingAddress.', '')] = issue.message;
      }
      return { values, fieldErrors, error: t('checkHighlighted') };
    }
    return { values, error: errorMessage(error) };
  }

  redirect(afterCheckout(checkout));
}

/** Where a new order goes next: its page when a saved card paid, else the payment form. */
function afterCheckout(checkout: CheckoutResponse): string {
  const token = `token=${checkout.accessToken}`;
  if (checkout.paid) return `/orders/${checkout.orderNumber}?${token}&placed=1`;
  const problem = checkout.paymentProblem
    ? `&error=${encodeURIComponent(checkout.paymentProblem)}`
    : '';
  return `/checkout/pay/${checkout.orderNumber}?${token}${problem}`;
}
