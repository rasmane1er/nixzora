'use server';

import { type ProductDetail, ProductVideoAddSchema } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function back(productId: string, call: () => Promise<string>): Promise<never> {
  const path = `/sell/listings/${productId}`;
  let target: string;
  try {
    target = `${path}?notice=${encodeURIComponent(await call())}#videos`;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/account/login?next=${encodeURIComponent(path)}`);
    }
    target = `${path}?error=${encodeURIComponent(errorMessage(error))}#videos`;
  }
  revalidatePath(path);
  redirect(target);
}

/** Product videos (p10-28): a YouTube or Vimeo link on the store's listing. */
export async function addVideo(form: FormData): Promise<void> {
  const productId = String(form.get('productId') ?? '');
  if (!UUID.test(productId)) redirect('/sell/listings');
  const t = await getT('videos');
  const parsed = ProductVideoAddSchema.safeParse({
    url: String(form.get('url') ?? ''),
    title: String(form.get('title') ?? ''),
  });
  if (!parsed.success) {
    redirect(`/sell/listings/${productId}?error=${encodeURIComponent(t('badUrl'))}#videos`);
  }
  const wasLive = form.get('live') === 'true';
  await back(productId, async () => {
    await api<ProductDetail>(`/seller/products/${productId}/videos`, {
      method: 'POST',
      body: parsed.data,
    });
    return wasLive ? t('addedReview') : t('added');
  });
}

export async function removeVideo(form: FormData): Promise<void> {
  const productId = String(form.get('productId') ?? '');
  const videoId = String(form.get('videoId') ?? '');
  if (!UUID.test(productId) || !UUID.test(videoId)) redirect('/sell/listings');
  const t = await getT('videos');
  await back(productId, async () => {
    await api(`/seller/products/${productId}/videos/${videoId}`, { method: 'DELETE' });
    return t('removed');
  });
}
