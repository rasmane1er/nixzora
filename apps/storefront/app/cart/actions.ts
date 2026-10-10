'use server';

import { type Cart } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { accessToken, saveGuestCartId } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function remember(cart: Cart): Promise<void> {
  // Guests: keep the cart id the API issued. Signed-in carts live on the account.
  if (cart.cartId && !(await accessToken())) await saveGuestCartId(cart.cartId);
  revalidatePath('/', 'layout');
}

export type AddResult = { ok: true; itemCount: number } | { ok: false; error: string };

export async function addToCart(variantId: string, quantity: number): Promise<AddResult> {
  if (!UUID.test(variantId)) {
    const t = await getT('cart');
    return { ok: false, error: t('chooseOption') };
  }
  try {
    const cart = await api<Cart>('/cart/items', {
      method: 'POST',
      cart: true,
      body: { variantId, quantity: Math.min(20, Math.max(1, Math.trunc(quantity) || 1)) },
    });
    await remember(cart);
    return { ok: true, itemCount: cart.itemCount };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateLine(form: FormData): Promise<void> {
  const variantId = String(form.get('variantId') ?? '');
  const quantity = Number(form.get('quantity') ?? 0);
  if (!UUID.test(variantId) || !Number.isInteger(quantity) || quantity < 0 || quantity > 20) {
    const t = await getT('cart');
    redirect(`/cart?error=${encodeURIComponent(t('badQuantity'))}`);
  }
  let message: string | null = null;
  try {
    const cart = await api<Cart>(`/cart/items/${variantId}`, {
      method: quantity === 0 ? 'DELETE' : 'PATCH',
      cart: true,
      ...(quantity === 0 ? {} : { body: { quantity } }),
    });
    await remember(cart);
  } catch (error) {
    message = errorMessage(error);
  }
  redirect(message ? `/cart?error=${encodeURIComponent(message)}` : '/cart');
}

export async function applyCoupon(form: FormData): Promise<void> {
  const code = String(form.get('code') ?? '')
    .trim()
    .slice(0, 32);
  let message: string | null = null;
  try {
    const cart = await api<Cart>('/cart/coupon', { method: 'POST', cart: true, body: { code } });
    await remember(cart);
  } catch (error) {
    message = errorMessage(error);
  }
  redirect(message ? `/cart?error=${encodeURIComponent(message)}` : '/cart');
}

export async function removeCoupon(): Promise<void> {
  try {
    const cart = await api<Cart>('/cart/coupon', { method: 'DELETE', cart: true });
    await remember(cart);
  } catch {
    // Nothing to remove.
  }
  redirect('/cart');
}

/** "Frequently bought together → Add all" (p10-06): adds each, one of each, in order. */
export async function addAllToCart(variantIds: string[]): Promise<AddResult> {
  const ids = [...new Set(variantIds)].filter((id) => UUID.test(id)).slice(0, 4);
  if (!ids.length) return { ok: false, error: (await getT('cart'))('chooseOption') };
  let result: AddResult = { ok: false, error: '' };
  for (const id of ids) {
    result = await addToCart(id, 1);
    if (!result.ok) return result;
  }
  return result;
}

/** Bundle & save (p10-16): one of each product in the bundle, added together. */
export async function addBundleToCart(bundleId: string): Promise<AddResult> {
  if (!UUID.test(bundleId)) return { ok: false, error: (await getT('bundles'))('unavailable') };
  try {
    const cart = await api<Cart>(`/cart/bundles/${bundleId}`, { method: 'POST', cart: true });
    await remember(cart);
    return { ok: true, itemCount: cart.itemCount };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// ───── Saved for later (p10-21) ─────

async function savedStep(
  form: FormData,
  path: (id: string) => string,
  method: string,
  notice?: string,
) {
  const variantId = String(form.get('variantId') ?? '');
  if (!UUID.test(variantId)) redirect('/cart');
  let message: string | null = null;
  try {
    await api(path(variantId), { method });
    revalidatePath('/', 'layout');
  } catch (error) {
    message = errorMessage(error);
  }
  redirect(
    message
      ? `/cart?error=${encodeURIComponent(message)}`
      : notice
        ? `/cart?notice=${encodeURIComponent(notice)}`
        : '/cart',
  );
}

/** Cart line → Saved for later (signed in). */
export async function saveForLater(form: FormData): Promise<void> {
  const t = await getT('saved');
  await savedStep(form, (id) => `/cart/items/${id}/save`, 'POST', t('savedNotice'));
}

/** Saved for later → cart. */
export async function moveSavedToCart(form: FormData): Promise<void> {
  const t = await getT('saved');
  await savedStep(form, (id) => `/me/saved/${id}/cart`, 'POST', t('movedNotice'));
}

export async function removeSaved(form: FormData): Promise<void> {
  await savedStep(form, (id) => `/me/saved/${id}`, 'DELETE');
}
