'use server';

import { type Cart, CartIdSchema, type CheckoutResponse, US_STATES } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
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

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? '').trim()]));
  const signedIn = Boolean(await accessToken());
  const cartId = await guestCartId();
  const buy = CartIdSchema.safeParse(form.get('buyNowId'));
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

  redirect(`/checkout/pay/${checkout.orderNumber}?token=${checkout.accessToken}`);
}
