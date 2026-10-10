'use server';

import { ProductVideoAddSchema } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { perform, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

/** Product videos (p10-28): a YouTube or Vimeo link on any product. */
export async function addVideo(form: FormData): Promise<void> {
  const id = uuidField(form, 'productId');
  const t = await getT('videos');
  const parsed = ProductVideoAddSchema.safeParse({
    url: String(form.get('url') ?? ''),
    title: String(form.get('title') ?? ''),
  });
  if (!parsed.success) redirect(`/products/${id}?error=${encodeURIComponent(t('badUrl'))}`);
  await perform(
    `/products/${id}`,
    () => api(`/admin/products/${id}/videos`, { method: 'POST', body: parsed.data }),
    t('added'),
  );
}

export async function removeVideo(form: FormData): Promise<void> {
  const id = uuidField(form, 'productId');
  const videoId = uuidField(form, 'videoId');
  const t = await getT('videos');
  await perform(
    `/products/${id}`,
    () => api(`/admin/products/${id}/videos/${videoId}`, { method: 'DELETE' }),
    t('removed'),
  );
}
