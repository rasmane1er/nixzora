'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { visitorId } from '@/lib/visitor';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH = '/account/history';

async function perform(call: () => Promise<unknown>, notice?: string): Promise<void> {
  try {
    await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/account/login?next=${encodeURIComponent(PATH)}`);
    }
    redirect(`${PATH}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(PATH);
  redirect(notice ? `${PATH}?notice=${encodeURIComponent(notice)}` : PATH);
}

function productId(form: FormData): string {
  const id = String(form.get('productId') ?? '');
  if (!UUID.test(id)) redirect(PATH);
  return id;
}

/** Turns a price-drop alert on or off for a product in the history (p10-19). */
export async function toggleHistoryAlert(form: FormData): Promise<void> {
  const id = productId(form);
  const on = form.get('on') === '1';
  await perform(() => api(`/me/alerts/${id}?kind=PRICE_DROP`, { method: on ? 'PUT' : 'DELETE' }));
}

/** Forgets one product from the browsing history. */
export async function removeFromHistory(form: FormData): Promise<void> {
  const id = productId(form);
  await perform(() => api(`/me/history/${id}`, { method: 'DELETE' }));
}

/** Forgets the whole history (this account and this browser). */
export async function clearHistory(): Promise<void> {
  const visitor = await visitorId();
  await perform(
    () =>
      api(`/me/shopping-history${visitor ? `?visitorId=${encodeURIComponent(visitor)}` : ''}`, {
        method: 'DELETE',
      }),
    (await getT('history'))('cleared'),
  );
}
