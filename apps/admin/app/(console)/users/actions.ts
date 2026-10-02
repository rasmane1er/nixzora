'use server';

import { api } from '@/lib/api';
import { perform, text, uuidField } from '@/lib/forms';

const ROLES = new Set(['customer', 'support', 'catalog_manager', 'admin']);

function role(form: FormData): string {
  const value = text(form, 'roleKey') ?? '';
  return ROLES.has(value) ? value : 'invalid';
}

export async function grantRole(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  await perform(
    `/users/${id}`,
    () => api(`/admin/users/${id}/roles`, { method: 'POST', body: { roleKey: role(form) } }),
    'Role granted.',
  );
}

export async function revokeRole(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  await perform(
    `/users/${id}`,
    () => api(`/admin/users/${id}/roles/${role(form)}`, { method: 'DELETE' }),
    'Role removed.',
  );
}

export async function setStatus(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const suspend = text(form, 'action') === 'suspend';
  await perform(
    `/users/${id}`,
    () => api(`/admin/users/${id}/${suspend ? 'suspend' : 'reactivate'}`, { method: 'POST' }),
    suspend ? 'Account suspended and signed out everywhere.' : 'Account reactivated.',
  );
}

export async function addNote(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  await perform(
    `/users/${id}`,
    () => api(`/admin/users/${id}/notes`, { method: 'POST', body: { body: text(form, 'body') } }),
    'Note added.',
  );
}
