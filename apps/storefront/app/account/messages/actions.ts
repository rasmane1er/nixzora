'use server';

import { type ConversationView } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { accessToken } from '@/lib/session';

export type MessageState = { error?: string; ok?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Starts (or continues) a conversation with a store, then opens it. */
export async function startConversation(_: MessageState, form: FormData): Promise<MessageState> {
  const store = String(form.get('store') ?? '');
  const productId = String(form.get('productId') ?? '');
  const orderNumber = String(form.get('orderNumber') ?? '');
  if (!(await accessToken())) {
    redirect(`/account/login?next=${encodeURIComponent(`/account/messages/new?store=${store}`)}`);
  }
  let thread: ConversationView;
  try {
    thread = await api<ConversationView>('/me/messages', {
      method: 'POST',
      body: {
        sellerHandle: store,
        ...(UUID.test(productId) ? { productId } : {}),
        ...(/^NX-[A-Z0-9]{6}$/.test(orderNumber) ? { orderNumber } : {}),
        body: String(form.get('body') ?? ''),
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/account/login');
    return { error: errorMessage(error) };
  }
  redirect(`/account/messages/${thread.id}`);
}

/** A reply from the customer (`side=customer`) or the store (`side=seller`). */
export async function reply(_: MessageState, form: FormData): Promise<MessageState> {
  const id = String(form.get('id') ?? '');
  const side = form.get('side') === 'seller' ? 'seller' : 'customer';
  if (!UUID.test(id)) return { error: (await getT('inbox'))('back') };
  const base = side === 'seller' ? '/seller/messages' : '/me/messages';
  try {
    await api(`${base}/${id}`, { method: 'POST', body: { body: String(form.get('body') ?? '') } });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath(side === 'seller' ? `/sell/messages/${id}` : `/account/messages/${id}`);
  return { ok: true };
}

export async function reportConversation(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const side = form.get('side') === 'seller' ? 'seller' : 'customer';
  if (!UUID.test(id)) return;
  const reason = String(form.get('reason') ?? '').trim() || 'Reported';
  const base = side === 'seller' ? '/seller/messages' : '/me/messages';
  await api(`${base}/${id}/report`, { method: 'POST', body: { reason } }).catch(() => undefined);
  revalidatePath(side === 'seller' ? `/sell/messages/${id}` : `/account/messages/${id}`);
}

export async function setClosed(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  await api(`/seller/messages/${id}/close`, {
    method: 'POST',
    body: { closed: form.get('closed') === 'true' },
  }).catch(() => undefined);
  revalidatePath(`/sell/messages/${id}`);
}
