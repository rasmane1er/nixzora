'use server';

import { api } from '@/lib/api';
import { perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

const ROLES = new Set(['customer', 'support', 'catalog_manager', 'admin']);

function role(form: FormData): string {
  const value = text(form, 'roleKey') ?? '';
  return ROLES.has(value) ? value : 'invalid';
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

export async function addNote(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsPeople');
  await perform(
    `/users/${id}`,
    () => api(`/admin/users/${id}/notes`, { method: 'POST', body: { body: text(form, 'body') } }),
    t('noteAdded'),
  );
}
