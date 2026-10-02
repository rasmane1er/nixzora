'use server';

import { type CheckoutResponse, US_STATES } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
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

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? '').trim()]));
  const signedIn = Boolean(await accessToken());
  const cartId = await guestCartId();

  if (!(US_STATES as readonly string[]).includes(values.region ?? '')) {
    return { values, fieldErrors: { region: 'Choose a state.' } };
  }

  let checkout: CheckoutResponse;
  try {
    checkout = await api<CheckoutResponse>('/checkout', {
      method: 'POST',
      body: {
        ...(signedIn || !cartId ? {} : { cartId }),
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
      return { values, fieldErrors, error: 'Check the highlighted fields.' };
    }
    return { values, error: errorMessage(error) };
  }

  redirect(`/checkout/pay/${checkout.orderNumber}?token=${checkout.accessToken}`);
}
