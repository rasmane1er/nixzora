'use server';

import { api } from '@/lib/api';
import { checked, integer, perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

export async function createCategory(form: FormData): Promise<void> {
  const t = await getT('opsCatalog');
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
    t('noticeCategoryCreated'),
  );
}

export async function setCategoryActive(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const isActive = text(form, 'isActive') === 'true';
  const t = await getT('opsCatalog');
  await perform(
    '/categories',
    () => api(`/admin/categories/${id}`, { method: 'PATCH', body: { isActive } }),
    isActive ? t('noticeCategoryShown') : t('noticeCategoryHidden'),
  );
}

export async function deleteCategory(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsCatalog');
  await perform(
    '/categories',
    () => api(`/admin/categories/${id}`, { method: 'DELETE' }),
    t('noticeCategoryDeleted'),
  );
}

export async function createBrand(form: FormData): Promise<void> {
  const t = await getT('opsCatalog');
  await perform(
    '/categories',
    () =>
      api('/admin/brands', {
        method: 'POST',
        body: { name: text(form, 'name'), slug: text(form, 'slug') },
      }),
    t('noticeBrandCreated'),
  );
}

export async function renameBrand(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsCatalog');
  await perform(
    '/categories',
    () => api(`/admin/brands/${id}`, { method: 'PATCH', body: { name: text(form, 'name') } }),
    t('noticeBrandRenamed'),
  );
}
