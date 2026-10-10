'use server';

import {
  type ProductAlertKind,
  type QuestionPage,
  type QuestionView,
  type ReviewPage,
  type ReviewSort,
  type UploadTicket,
} from '@nixzora/validation';
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
        // Uploaded photo keys, in order (p10-05); absent keeps the review's photos.
        ...(form.get('photosSent') === '1'
          ? { photoKeys: form.getAll('photoKeys').map(String).slice(0, 4) }
          : {}),
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
  options: { page: number; sort: ReviewSort; rating: number | null; withPhotos?: boolean },
): Promise<ReviewPage | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const query = new URLSearchParams({ page: String(options.page), sort: options.sort });
  if (options.rating) query.set('rating', String(options.rating));
  if (options.withPhotos) query.set('withPhotos', 'true');
  try {
    return await api<ReviewPage>(`/catalog/products/${slug}/reviews?${query}`, {
      auth: false,
      revalidate: 30,
    });
  } catch {
    return null;
  }
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function attempt<T>(call: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await call() };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

const UUID = /^[0-9a-f-]{36}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A link to upload one review photo straight to storage (p10-05). */
export async function requestReviewPhotoUpload(
  contentType: string,
  sizeBytes: number,
): Promise<Result<UploadTicket>> {
  return attempt(() =>
    api<UploadTicket>('/catalog/reviews/photos/upload', {
      method: 'POST',
      body: { contentType, sizeBytes },
    }),
  );
}

/** "Was this helpful?" — true to vote, false to take it back. */
export async function voteHelpful(
  reviewId: string,
  helpful: boolean,
): Promise<Result<{ helpfulCount: number; voted: boolean }>> {
  if (!UUID.test(reviewId)) return { ok: false, error: 'Invalid review' };
  return attempt(() =>
    api<{ helpfulCount: number; voted: boolean }>(`/catalog/reviews/${reviewId}/helpful`, {
      method: 'POST',
      body: { helpful },
    }),
  );
}

export async function loadQuestions(
  slug: string,
  options: { page: number; q?: string },
): Promise<QuestionPage | null> {
  if (!SLUG.test(slug)) return null;
  const query = new URLSearchParams({ page: String(options.page) });
  if (options.q?.trim()) query.set('q', options.q.trim().slice(0, 100));
  return api<QuestionPage>(`/catalog/products/${slug}/questions?${query}`).catch(() => null);
}

export async function askQuestion(slug: string, body: string): Promise<Result<QuestionView>> {
  if (!SLUG.test(slug)) return { ok: false, error: 'Invalid product' };
  return attempt(() =>
    api<QuestionView>(`/catalog/products/${slug}/questions`, { method: 'POST', body: { body } }),
  );
}

export async function answerQuestion(
  questionId: string,
  body: string,
): Promise<Result<QuestionView>> {
  if (!UUID.test(questionId)) return { ok: false, error: 'Invalid question' };
  return attempt(() =>
    api<QuestionView>(`/catalog/questions/${questionId}/answers`, {
      method: 'POST',
      body: { body },
    }),
  );
}

/** Back-in-stock alert on a sold-out product page (p10-06). */
export async function setStockAlert(
  productId: string,
  on: boolean,
  kind: ProductAlertKind = 'BACK_IN_STOCK',
): Promise<Result<null>> {
  if (!UUID.test(productId)) return { ok: false, error: 'Invalid product' };
  return attempt(async () => {
    await api(`/me/alerts/${productId}?kind=${kind}`, { method: on ? 'PUT' : 'DELETE' });
    return null;
  });
}
