'use server';

import { redirect } from 'next/navigation';
import { ApiError, api } from '@/lib/api';
import { problemMessage, text } from '@/lib/forms';
import { getT } from '@/lib/i18n';

type ReindexResult = { scanned: number; updated: number; skipped: boolean };

/** Re-embeds changed products, or every product with "force" (after a model change). */
export async function reindex(form: FormData): Promise<void> {
  const force = text(form, 'force') === 'true';
  const t = await getT('opsPeople');
  let target: string;
  try {
    const result = await api<ReindexResult>(`/admin/search/reindex${force ? '?force=true' : ''}`, {
      method: 'POST',
    });
    const notice = result.skipped
      ? t('reindexRunning')
      : t('reindexDone', { updated: result.updated, scanned: result.scanned });
    target = `/ai?notice=${encodeURIComponent(notice)}`;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login?expired=1');
    target = `/ai?error=${encodeURIComponent(await problemMessage(error))}`;
  }
  redirect(target);
}
