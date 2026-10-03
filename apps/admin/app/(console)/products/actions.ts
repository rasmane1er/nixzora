'use server';

import {
  type ProductCopySuggestion,
  type ProductDetail,
  type UploadTicket,
} from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cents, checked, integer, pairs, perform, text, uuidField } from '@/lib/forms';

/** "RAM (GB)" → "ram_gb": attribute names are snake_case so the store can filter on them. */
function attributeKey(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return /^[a-z]/.test(key) ? key : `a_${key}`.slice(0, 40);
}

/** Free-text attribute values become numbers or booleans when they clearly are. */
function typedAttributes(raw: Record<string, string>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [label, value] of Object.entries(raw)) {
    const key = attributeKey(label);
    if (value === 'true' || value === 'false') out[key] = value === 'true';
    else if (/^-?\d+(\.\d+)?$/.test(value)) out[key] = Number(value);
    else out[key] = value;
  }
  return out;
}

const VARIANT_ROWS = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createProduct(form: FormData): Promise<void> {
  await perform(
    '/products/new',
    () =>
      api<ProductDetail>('/admin/products', {
        method: 'POST',
        body: {
          title: text(form, 'title'),
          slug: text(form, 'slug'),
          description: text(form, 'description'),
          status: text(form, 'status') ?? 'DRAFT',
          categoryId: text(form, 'categoryId'),
          brandId: text(form, 'brandId') ?? null,
          attributes: typedAttributes(pairs(form, 'attributes')),
          variants: Array.from({ length: VARIANT_ROWS }, (_, i) => i)
            .filter((i) => text(form, `v${i}.sku`))
            .map((i) => ({
              sku: text(form, `v${i}.sku`),
              title: text(form, `v${i}.title`) ?? text(form, `v${i}.sku`),
              options: pairs(form, `v${i}.options`),
              priceCents: cents(form, `v${i}.price`),
              compareAtCents: cents(form, `v${i}.compareAt`) ?? null,
              initialStock: integer(form, `v${i}.stock`) ?? 0,
            })),
        },
      }),
    'Product created.',
    (product) => `/products/${(product as ProductDetail).id}`,
  );
}

export async function updateProduct(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  await perform(
    `/products/${id}`,
    () =>
      api(`/admin/products/${id}`, {
        method: 'PATCH',
        body: {
          title: text(form, 'title'),
          slug: text(form, 'slug'),
          description: text(form, 'description'),
          status: text(form, 'status'),
          categoryId: text(form, 'categoryId'),
          brandId: text(form, 'brandId') ?? null,
          attributes: typedAttributes(pairs(form, 'attributes')),
        },
      }),
    'Product saved.',
  );
}

export async function addVariant(form: FormData): Promise<void> {
  const id = uuidField(form, 'productId');
  await perform(
    `/products/${id}`,
    () =>
      api(`/admin/products/${id}/variants`, {
        method: 'POST',
        body: {
          sku: text(form, 'sku'),
          title: text(form, 'title'),
          options: pairs(form, 'options'),
          priceCents: cents(form, 'price'),
          compareAtCents: cents(form, 'compareAt') ?? null,
          barcode: text(form, 'barcode') ?? null,
          initialStock: integer(form, 'stock') ?? 0,
        },
      }),
    'Variant added.',
  );
}

export async function updateVariant(form: FormData): Promise<void> {
  const productId = uuidField(form, 'productId');
  const id = uuidField(form, 'variantId');
  await perform(
    `/products/${productId}`,
    () =>
      api(`/admin/variants/${id}`, {
        method: 'PATCH',
        body: {
          title: text(form, 'title'),
          priceCents: cents(form, 'price'),
          compareAtCents: cents(form, 'compareAt') ?? null,
          barcode: text(form, 'barcode') ?? null,
          isActive: checked(form, 'isActive'),
        },
      }),
    'Variant saved.',
  );
}

export async function adjustStock(form: FormData): Promise<void> {
  const back = text(form, 'back') ?? '/inventory';
  const id = uuidField(form, 'variantId');
  await perform(
    back,
    () =>
      api(`/admin/inventory/${id}/adjust`, {
        method: 'POST',
        body: {
          delta: integer(form, 'delta'),
          reason: text(form, 'reason') ?? 'CORRECTION',
          note: text(form, 'note'),
        },
      }),
    'Stock updated.',
  );
}

// ───── Image upload (called from the browser component) ─────

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof ApiError && error.status === 401) {
    return { ok: false, error: 'Your session ended. Reload the page and sign in again.' };
  }
  return { ok: false, error: errorMessage(error) };
}

export async function requestUpload(
  contentType: string,
  sizeBytes: number,
): Promise<Result<UploadTicket>> {
  try {
    const ticket = await api<UploadTicket>('/admin/uploads', {
      method: 'POST',
      body: { contentType, sizeBytes },
    });
    return { ok: true, data: ticket };
  } catch (error) {
    return failure(error);
  }
}

export async function attachImage(
  productId: string,
  storageKey: string,
  alt: string,
): Promise<Result<null>> {
  if (!UUID.test(productId)) return { ok: false, error: 'Unknown product.' };
  try {
    await api(`/admin/products/${productId}/images`, {
      method: 'POST',
      body: { storageKey, alt },
    });
    revalidatePath(`/products/${productId}`);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export type CopyDraft = {
  description?: string;
  aiWritten?: boolean;
  notes?: string[];
  error?: string;
};

/** A draft description for the editor (p6-03). It only fills the form; staff decide to save. */
export async function suggestCopy(productId: string): Promise<CopyDraft> {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { error: 'Unknown product.' };
  try {
    return await api<ProductCopySuggestion>(`/admin/products/${productId}/copy-suggestion`, {
      method: 'POST',
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function reorderImages(productId: string, imageIds: string[]): Promise<Result<null>> {
  if (!UUID.test(productId) || !imageIds.every((i) => UUID.test(i))) {
    return { ok: false, error: 'Unknown product.' };
  }
  try {
    await api(`/admin/products/${productId}/images/order`, { method: 'PUT', body: { imageIds } });
    revalidatePath(`/products/${productId}`);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteImage(productId: string, imageId: string): Promise<Result<null>> {
  if (!UUID.test(productId) || !UUID.test(imageId)) return { ok: false, error: 'Unknown image.' };
  try {
    await api(`/admin/products/${productId}/images/${imageId}`, { method: 'DELETE' });
    revalidatePath(`/products/${productId}`);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}
