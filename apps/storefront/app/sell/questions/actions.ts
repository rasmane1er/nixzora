'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

/** A store answers a shopper's question from the seller portal (p10-05). */
export async function answerFromPortal(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const body = String(form.get('body') ?? '').trim();
  let target = '/sell/questions';
  try {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid question');
    await api(`/catalog/questions/${id}/answers`, { method: 'POST', body: { body } });
    target += `?notice=${encodeURIComponent((await getT('community'))('answered'))}`;
  } catch (error) {
    target += `?error=${encodeURIComponent(errorMessage(error))}`;
  }
  revalidatePath('/sell/questions');
  redirect(target);
}
