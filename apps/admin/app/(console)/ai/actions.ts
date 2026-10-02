'use server';

import { redirect } from 'next/navigation';
import { ApiError, api, errorMessage } from '@/lib/api';
import { text } from '@/lib/forms';

type ReindexResult = { scanned: number; updated: number; skipped: boolean };

/** Re-embeds changed products, or every product with "force" (after a model change). */
export async function reindex(form: FormData): Promise<void> {
  const force = text(form, 'force') === 'true';
  let target: string;
  try {
    const result = await api<ReindexResult>(`/admin/search/reindex${force ? '?force=true' : ''}`, {
      method: 'POST',
    });
    const notice = result.skipped
      ? 'A reindex is already running. Try again in a minute.'
      : `Search index updated: ${result.updated} of ${result.scanned} products re-embedded.`;
    target = `/ai?notice=${encodeURIComponent(notice)}`;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login?expired=1');
    target = `/ai?error=${encodeURIComponent(errorMessage(error))}`;
  }
  redirect(target);
}
