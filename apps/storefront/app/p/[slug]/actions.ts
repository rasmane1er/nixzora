'use server';

import { revalidatePath } from 'next/cache';
import { api, errorMessage } from '@/lib/api';

export type ReviewState = { ok?: boolean; error?: string };

export async function submitReview(_: ReviewState, form: FormData): Promise<ReviewState> {
  const slug = String(form.get('slug') ?? '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { error: 'Unknown product.' };
  try {
    await api(`/catalog/products/${slug}/reviews`, {
      method: 'POST',
      body: {
        rating: Number(form.get('rating')),
        title: String(form.get('title') ?? ''),
        body: String(form.get('body') ?? ''),
      },
    });
    revalidatePath(`/p/${slug}`);
    return { ok: true };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
