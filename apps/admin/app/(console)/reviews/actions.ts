'use server';

import { api } from '@/lib/api';
import { perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

export async function moderate(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const status = text(form, 'status') === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  const t = await getT('opsCatalog');
  await perform(
    text(form, 'back') ?? '/reviews',
    () => api(`/admin/reviews/${id}/moderation`, { method: 'POST', body: { status } }),
    status === 'APPROVED' ? t('noticeReviewPublished') : t('noticeReviewRejected'),
  );
}
