'use server';

import { api } from '@/lib/api';
import { perform, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

/** Support ends a NIXZORA Plus membership now (p10-15). */
export async function endMembership(form: FormData): Promise<void> {
  const userId = uuidField(form, 'userId');
  const t = await getT('plus');
  await perform('/plus', () => api(`/admin/plus/${userId}/end`, { method: 'POST' }), t('ended'));
}
