'use server';

import { api } from '@/lib/api';
import { perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

/** Clear a fraud review, or confirm it (a held order is cancelled and refunded by the API). */
export async function reviewRisk(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const outcome = text(form, 'outcome') === 'confirm' ? 'confirm' : 'clear';
  const back = text(form, 'back') ?? '/risk';
  const t = await getT('opsRisk');
  await perform(
    back,
    () =>
      api(`/admin/risk/${id}/review`, {
        method: 'POST',
        body: { outcome, note: text(form, 'note') },
      }),
    t(outcome === 'clear' ? 'noticeCleared' : 'noticeConfirmed'),
  );
}
