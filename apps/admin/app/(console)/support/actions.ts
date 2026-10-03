'use server';

import { api } from '@/lib/api';
import { perform, text, uuidField } from '@/lib/forms';

export async function replySupport(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const status = text(form, 'status') ?? 'ANSWERED';
  const back = text(form, 'back') ?? '/support';
  await perform(
    back.startsWith('/support') ? back : '/support',
    () =>
      api(`/admin/support/${id}/reply`, {
        method: 'POST',
        body: { reply: text(form, 'reply'), status },
      }),
    text(form, 'reply') ? 'Reply sent to the customer.' : 'Status updated.',
  );
}
