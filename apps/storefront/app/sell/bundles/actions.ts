'use server';

import { BundleCreateSchema } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = '/sell/bundles';

async function perform(call: () => Promise<unknown>, notice: 'created' | 'archived') {
  const t = await getT('bundles');
  try {
    await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/account/login?next=${encodeURIComponent(PAGE)}`);
    }
    redirect(`${PAGE}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?notice=${encodeURIComponent(t(notice))}`);
}

export async function createBundle(form: FormData): Promise<void> {
  const parsed = BundleCreateSchema.safeParse({
    title: String(form.get('title') ?? ''),
    percentOff: Number(form.get('percentOff')),
    productIds: form.getAll('productIds').map(String),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    redirect(
      `${PAGE}?error=${encodeURIComponent(`${String(issue?.path[0] ?? '')}: ${issue?.message ?? ''}`)}`,
    );
  }
  await perform(() => api('/seller/bundles', { method: 'POST', body: parsed.data }), 'created');
}

export async function archiveBundle(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  await perform(() => api(`/seller/bundles/${id}/archive`, { method: 'POST' }), 'archived');
}
