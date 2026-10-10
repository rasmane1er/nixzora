'use server';

import { RoleKeySchema } from '@nixzora/validation';
import { api } from '@/lib/api';
import { cents, perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

function role(form: FormData): string {
  const parsed = RoleKeySchema.safeParse(text(form, 'roleKey'));
  return parsed.success ? parsed.data : 'invalid';
}

export async function grantRole(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsPeople');
  await perform(
    `/users/${id}`,
    () => api(`/admin/users/${id}/roles`, { method: 'POST', body: { roleKey: role(form) } }),
    t('roleGranted'),
  );
}

export async function revokeRole(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsPeople');
  await perform(
    `/users/${id}`,
    () => api(`/admin/users/${id}/roles/${role(form)}`, { method: 'DELETE' }),
    t('roleRemoved'),
  );
}

export async function setStatus(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const suspend = text(form, 'action') === 'suspend';
  const t = await getT('opsPeople');
  await perform(
    `/users/${id}`,
    () => api(`/admin/users/${id}/${suspend ? 'suspend' : 'reactivate'}`, { method: 'POST' }),
    suspend ? t('accountSuspended') : t('accountReactivated'),
  );
}

export async function resumeEmails(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsPeople');
  await perform(
    `/users/${id}`,
    () => api(`/admin/users/${id}/emails/resume`, { method: 'POST' }),
    t('emailsResumed'),
  );
}

export async function addNote(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsPeople');
  await perform(
    `/users/${id}`,
    () => api(`/admin/users/${id}/notes`, { method: 'POST', body: { body: text(form, 'body') } }),
    t('noteAdded'),
  );
}

/** Goodwill credit to the customer's gift card balance (p10-10). */
export async function grantGiftCredit(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('gifts');
  await perform(
    `/users/${id}`,
    () =>
      api(`/admin/users/${id}/gift-credit`, {
        method: 'POST',
        body: { amountCents: cents(form, 'amount'), note: text(form, 'note') ?? '' },
      }),
    t('granted'),
  );
}
