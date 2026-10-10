'use server';

import { api } from '@/lib/api';
import { perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

export async function moderateConversation(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const action = text(form, 'action');
  const t = await getT('inbox');
  await perform(
    '/messages',
    () => api(`/admin/messages/${id}/moderate`, { method: 'POST', body: { action } }),
    t(action === 'hide' ? 'hidden' : action === 'restore' ? 'restore' : 'dismiss'),
  );
}
