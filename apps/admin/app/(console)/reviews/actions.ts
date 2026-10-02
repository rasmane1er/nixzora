'use server';

import { api } from '@/lib/api';
import { perform, text, uuidField } from '@/lib/forms';

export async function moderate(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const status = text(form, 'status') === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  await perform(
    text(form, 'back') ?? '/reviews',
    () => api(`/admin/reviews/${id}/moderation`, { method: 'POST', body: { status } }),
    status === 'APPROVED' ? 'Review published.' : 'Review rejected.',
  );
}
