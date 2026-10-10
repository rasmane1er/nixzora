'use server';

import { BundleCreateSchema } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { perform, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

const PAGE = '/bundles';

/** Bundle & save (p10-16): a bundle of NIXZORA's own products. */
export async function createBundle(form: FormData): Promise<void> {
  const t = await getT('bundles');
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
  await perform(
    PAGE,
    () => api('/admin/bundles', { method: 'POST', body: parsed.data }),
    t('created'),
  );
}

export async function archiveBundle(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('bundles');
  await perform(PAGE, () => api(`/admin/bundles/${id}/archive`, { method: 'POST' }), t('archived'));
}
