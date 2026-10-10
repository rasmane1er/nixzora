'use server';

import {
  ShoppingListCreateSchema,
  type ShoppingListSummary,
  ShoppingListUpdateSchema,
  type ShoppingListView,
} from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { accessToken } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ListState = { ok?: boolean; error?: string; message?: string };

function fields(form: FormData) {
  const eventDate = String(form.get('eventDate') ?? '').trim();
  const note = String(form.get('note') ?? '').trim();
  return {
    name: String(form.get('name') ?? '').trim(),
    kind: form.get('kind') === 'REGISTRY' ? ('REGISTRY' as const) : ('LIST' as const),
    eventDate: eventDate || null,
    note: note || null,
    isShared: form.get('isShared') === 'on',
  };
}

export async function createList(_: ListState, form: FormData): Promise<ListState> {
  const parsed = ShoppingListCreateSchema.safeParse(fields(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  let list: ShoppingListSummary;
  try {
    list = await api<ShoppingListSummary>('/me/lists', { method: 'POST', body: parsed.data });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  redirect(`/account/lists/${list.id}`);
}

export async function updateList(_: ListState, form: FormData): Promise<ListState> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return { error: (await getT('lists'))('notFound') };
  const parsed = ShoppingListUpdateSchema.safeParse(fields(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api(`/me/lists/${id}`, { method: 'PATCH', body: parsed.data });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath(`/account/lists/${id}`);
  return { ok: true, message: (await getT('lists'))('saved') };
}

export async function deleteList(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (UUID.test(id)) await api(`/me/lists/${id}`, { method: 'DELETE' }).catch(() => undefined);
  revalidatePath('/account/lists');
  redirect('/account/lists');
}

export async function resetListLink(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  await api(`/me/lists/${id}/reset-link`, { method: 'POST' }).catch(() => undefined);
  revalidatePath(`/account/lists/${id}`);
}

export async function removeListItem(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const productId = String(form.get('productId') ?? '');
  if (!UUID.test(id) || !UUID.test(productId)) return;
  await api(`/me/lists/${id}/items/${productId}`, { method: 'DELETE' }).catch(() => undefined);
  revalidatePath(`/account/lists/${id}`);
}

// ───── "Add to list" on a product ─────

export type ListPicker =
  { signIn: true } | { signIn?: false; lists: ShoppingListSummary[]; containing: string[] };

/** The shopper's lists, and which already hold this product. */
export async function listsFor(productId: string): Promise<ListPicker> {
  if (!UUID.test(productId) || !(await accessToken())) return { signIn: true };
  try {
    const [lists, containing] = await Promise.all([
      api<ShoppingListSummary[]>('/me/lists'),
      api<string[]>(`/me/lists/containing/${productId}`),
    ]);
    return { lists, containing };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { signIn: true };
    return { lists: [], containing: [] };
  }
}

export type ToggleResult = { ok: true } | { ok: false; error: string };

export async function toggleListItem(
  listId: string,
  productId: string,
  on: boolean,
): Promise<ToggleResult> {
  if (!UUID.test(listId) || !UUID.test(productId)) {
    return { ok: false, error: (await getT('lists'))('notFound') };
  }
  try {
    if (on) {
      await api<ShoppingListView>(`/me/lists/${listId}/items`, {
        method: 'POST',
        body: { productId },
      });
    } else {
      await api(`/me/lists/${listId}/items/${productId}`, { method: 'DELETE' });
    }
    revalidatePath(`/account/lists/${listId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Makes a list and puts the product on it, from the product page. */
export async function createListWith(
  name: string,
  productId: string,
): Promise<{ ok: true; list: ShoppingListSummary } | { ok: false; error: string }> {
  if (!UUID.test(productId)) return { ok: false, error: (await getT('lists'))('notFound') };
  const parsed = ShoppingListCreateSchema.safeParse({ name: name.trim() });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? '' };
  try {
    const list = await api<ShoppingListSummary>('/me/lists', { method: 'POST', body: parsed.data });
    await api(`/me/lists/${list.id}/items`, { method: 'POST', body: { productId } });
    revalidatePath('/account/lists');
    return { ok: true, list: { ...list, itemCount: list.itemCount + 1 } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
