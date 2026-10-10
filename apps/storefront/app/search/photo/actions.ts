'use server';

import { VISUAL_SEARCH_MAX_BASE64, type VisualSearchResult } from '@nixzora/validation';
import { api, ApiError } from '@/lib/api';

export type PhotoSearchOutcome = { id: string } | { error: 'tooLarge' | 'unreadable' | 'failed' };

/** Sends the (already shrunk) photo to the API; the page then shows the result by its id. */
export async function searchByPhoto(image: string): Promise<PhotoSearchOutcome> {
  if (typeof image !== 'string' || image.length < 100) return { error: 'unreadable' };
  if (image.length > VISUAL_SEARCH_MAX_BASE64) return { error: 'tooLarge' };
  try {
    const result = await api<VisualSearchResult>('/catalog/visual-search', {
      method: 'POST',
      body: { image },
    });
    return { id: result.id };
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      return { error: /large/i.test(error.message) ? 'tooLarge' : 'unreadable' };
    }
    return { error: 'failed' };
  }
}
