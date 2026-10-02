'use server';

import { api } from '@/lib/api';
import { checked, integer, perform, text, uuidField } from '@/lib/forms';

export async function createCategory(form: FormData): Promise<void> {
  await perform(
    '/categories',
    () =>
      api('/admin/categories', {
        method: 'POST',
        body: {
          name: text(form, 'name'),
          slug: text(form, 'slug'),
          parentId: text(form, 'parentId') ?? null,
          description: text(form, 'description'),
          position: integer(form, 'position'),
          isActive: checked(form, 'isActive'),
        },
      }),
    'Category created.',
  );
}

export async function setCategoryActive(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const isActive = text(form, 'isActive') === 'true';
  await perform(
    '/categories',
    () => api(`/admin/categories/${id}`, { method: 'PATCH', body: { isActive } }),
    isActive ? 'Category is visible on the store.' : 'Category hidden from the store.',
  );
}

export async function deleteCategory(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  await perform(
    '/categories',
    () => api(`/admin/categories/${id}`, { method: 'DELETE' }),
    'Category deleted.',
  );
}

export async function createBrand(form: FormData): Promise<void> {
  await perform(
    '/categories',
    () =>
      api('/admin/brands', {
        method: 'POST',
        body: { name: text(form, 'name'), slug: text(form, 'slug') },
      }),
    'Brand created.',
  );
}

export async function renameBrand(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  await perform(
    '/categories',
    () => api(`/admin/brands/${id}`, { method: 'PATCH', body: { name: text(form, 'name') } }),
    'Brand renamed.',
  );
}
