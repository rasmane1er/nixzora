'use server';

import { api } from '@/lib/api';
import { perform, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

export async function hideQuestion(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('community');
  await perform(
    '/questions',
    () => api(`/admin/questions/${id}/hide`, { method: 'POST' }),
    t('noticeHidden'),
  );
}

export async function hideAnswer(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('community');
  await perform(
    '/questions',
    () => api(`/admin/answers/${id}/hide`, { method: 'POST' }),
    t('noticeHidden'),
  );
}
