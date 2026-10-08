'use server';

import { type ReviewPage, type ReviewSort } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { ensureVisitorId } from '@/lib/visitor';

export type ReviewState = { ok?: boolean; error?: string };

export async function submitReview(_: ReviewState, form: FormData): Promise<ReviewState> {
  const slug = String(form.get('slug') ?? '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    return { error: (await getT('productPage'))('unknownProduct') };
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

/** Records a product view for recommendations. Never fails the page. */
export async function recordView(productId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return;
  try {
    const visitor = await ensureVisitorId();
    await api('/events/views', { method: 'POST', body: { productId, visitorId: visitor } });
  } catch {
    // Recommendations are best-effort.
  }
}

/** One page of a product's reviews, for "Show more", sorting and the star filter. */
export async function loadReviews(
  slug: string,
  options: { page: number; sort: ReviewSort; rating: number | null },
): Promise<ReviewPage | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const query = new URLSearchParams({ page: String(options.page), sort: options.sort });
  if (options.rating) query.set('rating', String(options.rating));
  try {
    return await api<ReviewPage>(`/catalog/products/${slug}/reviews?${query}`, {
      auth: false,
      revalidate: 30,
    });
  } catch {
    return null;
  }
}
