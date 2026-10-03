'use server';

import {
  type InventoryAdjust,
  type ListingImportResult,
  type ProductCopySuggestion,
  type ProductDetail,
  type SellerView,
  type UploadTicket,
} from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function id(form: FormData, name = 'id'): string {
  const value = text(form, name) ?? '';
  if (!UUID.test(value)) throw new Error('Invalid id');
  return value;
}

/** "249", "249.5" or "$1,249.00" → cents. */
function cents(form: FormData, name: string): number | undefined {
  const raw = text(form, name)?.replace(/[$,\s]/g, '');
  if (!raw) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return Number.NaN;
  return Math.round(Number(raw) * 100);
}

/** "watts: 60" lines → { watts: 60 }. Numbers and yes/no become numbers and booleans. */
function specs(form: FormData, name: string): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const line of (text(form, name) ?? '').split('\n')) {
    const match = /^\s*([^:]+?)\s*:\s*(.+?)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1]!
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const value = match[2]!;
    if (!key) continue;
    out[key] = /^-?\d+(\.\d+)?$/.test(value)
      ? Number(value)
      : /^(yes|true)$/i.test(value)
        ? true
        : /^(no|false)$/i.test(value)
          ? false
          : value;
  }
  return out;
}

function withMessage(path: string, kind: 'notice' | 'error', message: string): string {
  const [base, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  params.delete('notice');
  params.delete('error');
  params.set(kind, message);
  return `${base}?${params.toString()}`;
}

/** Runs an API call, then returns to `path` with a notice or the API's error message. */
async function perform(path: string, call: () => Promise<unknown>, notice: string) {
  try {
    await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/account/login?next=${encodeURIComponent(path)}`);
    }
    redirect(withMessage(path, 'error', errorMessage(error)));
  }
  revalidatePath(path.split('?')[0]!);
  redirect(withMessage(path, 'notice', notice));
}

// ───── Store ─────

export async function applyToSell(form: FormData): Promise<void> {
  await perform(
    '/sell',
    () =>
      api<SellerView>('/seller/apply', {
        method: 'POST',
        body: {
          displayName: text(form, 'displayName'),
          legalName: text(form, 'legalName'),
          handle: text(form, 'handle')?.toLowerCase(),
          contactEmail: text(form, 'contactEmail'),
          description: text(form, 'description'),
          acceptTerms: form.get('acceptTerms') === 'on',
        },
      }),
    'Application received. Next, verify your business for payouts.',
  );
}

export async function updateStore(form: FormData): Promise<void> {
  await perform(
    '/sell/settings',
    () =>
      api('/seller/me', {
        method: 'PATCH',
        body: {
          displayName: text(form, 'displayName'),
          contactEmail: text(form, 'contactEmail'),
          description: text(form, 'description') ?? null,
        },
      }),
    'Store details saved.',
  );
}

// ───── Listings ─────

export async function createListing(form: FormData): Promise<void> {
  let created: ProductDetail;
  try {
    created = await api<ProductDetail>('/seller/products', {
      method: 'POST',
      body: {
        title: text(form, 'title'),
        description: text(form, 'description'),
        categoryId: text(form, 'categoryId'),
        attributes: specs(form, 'specs'),
        variants: [
          {
            sku: text(form, 'sku'),
            title: text(form, 'variantTitle') ?? 'Standard',
            priceCents: cents(form, 'price'),
            compareAtCents: cents(form, 'compareAt') ?? null,
            initialStock: Number(text(form, 'stock') ?? 0),
          },
        ],
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      redirect('/account/login?next=/sell/listings/new');
    redirect(withMessage('/sell/listings/new', 'error', errorMessage(error)));
  }
  redirect(
    `/sell/listings/${created.id}?notice=${encodeURIComponent('Draft saved. Add a photo, then submit it for review.')}`,
  );
}

export async function updateListing(form: FormData): Promise<void> {
  const productId = id(form);
  await perform(
    `/sell/listings/${productId}`,
    () =>
      api(`/seller/products/${productId}`, {
        method: 'PATCH',
        body: {
          title: text(form, 'title'),
          description: text(form, 'description'),
          categoryId: text(form, 'categoryId'),
          attributes: specs(form, 'specs'),
        },
      }),
    'Listing saved.',
  );
}

export async function addVariant(form: FormData): Promise<void> {
  const productId = id(form);
  await perform(
    `/sell/listings/${productId}`,
    () =>
      api(`/seller/products/${productId}/variants`, {
        method: 'POST',
        body: {
          sku: text(form, 'sku'),
          title: text(form, 'variantTitle'),
          priceCents: cents(form, 'price'),
          compareAtCents: cents(form, 'compareAt') ?? null,
          initialStock: Number(text(form, 'stock') ?? 0),
        },
      }),
    'Option added.',
  );
}

export async function updateVariant(form: FormData): Promise<void> {
  const productId = id(form, 'productId');
  const variantId = id(form, 'variantId');
  await perform(
    `/sell/listings/${productId}`,
    () =>
      api(`/seller/variants/${variantId}`, {
        method: 'PATCH',
        body: {
          priceCents: cents(form, 'price'),
          compareAtCents: cents(form, 'compareAt') ?? null,
          isActive: form.get('isActive') === 'on',
        },
      }),
    'Price saved.',
  );
}

export async function adjustStock(form: FormData): Promise<void> {
  const productId = id(form, 'productId');
  const variantId = id(form, 'variantId');
  const delta = Number(text(form, 'delta') ?? 0);
  const body: InventoryAdjust = {
    delta,
    reason: delta > 0 ? 'RECEIVED' : 'CORRECTION',
    note: 'Seller portal',
  };
  await perform(
    `/sell/listings/${productId}`,
    () => api(`/seller/variants/${variantId}/stock`, { method: 'POST', body }),
    'Stock updated.',
  );
}

export async function submitListing(form: FormData): Promise<void> {
  const productId = id(form);
  await perform(
    `/sell/listings/${productId}`,
    () => api(`/seller/products/${productId}/submit`, { method: 'POST' }),
    'Submitted. We usually review listings within one business day.',
  );
}

export async function withdrawListing(form: FormData): Promise<void> {
  const productId = id(form);
  await perform(
    `/sell/listings/${productId}`,
    () => api(`/seller/products/${productId}/withdraw`, { method: 'POST' }),
    'Listing moved back to draft.',
  );
}

export async function removePhoto(form: FormData): Promise<void> {
  const productId = id(form);
  const imageId = id(form, 'imageId');
  await perform(
    `/sell/listings/${productId}`,
    () => api(`/seller/products/${productId}/images/${imageId}`, { method: 'DELETE' }),
    'Photo removed.',
  );
}

// ───── Bulk listings (CSV) ─────

export async function importListings(
  csv: string,
  dryRun: boolean,
): Promise<Result<ListingImportResult>> {
  try {
    return {
      ok: true,
      data: await api<ListingImportResult>('/seller/products/import', {
        method: 'POST',
        body: { csv, dryRun },
      }),
    };
  } catch (error) {
    return failure(error);
  } finally {
    if (!dryRun) revalidatePath('/sell/listings');
  }
}

// ───── AI listing assistant ─────

export async function suggestListingCopy(
  productId: string,
): Promise<Result<ProductCopySuggestion>> {
  if (!UUID.test(productId)) return { ok: false, error: 'Unknown listing.' };
  try {
    return {
      ok: true,
      data: await api<ProductCopySuggestion>(`/seller/products/${productId}/copy-suggestion`, {
        method: 'POST',
      }),
    };
  } catch (error) {
    return failure(error);
  }
}

// ───── Orders ─────

export async function shipSellerOrder(form: FormData): Promise<void> {
  const orderId = id(form);
  await perform(
    `/sell/orders/${orderId}`,
    () =>
      api(`/seller/orders/${orderId}/ship`, {
        method: 'POST',
        body: { carrier: text(form, 'carrier'), trackingNumber: text(form, 'trackingNumber') },
      }),
    'Marked as shipped. The customer gets the tracking number.',
  );
}

// ───── Photo upload (called from the browser component) ─────

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof ApiError && error.status === 401) {
    return { ok: false, error: 'Your session ended. Reload the page and sign in again.' };
  }
  return { ok: false, error: errorMessage(error) };
}

export async function requestPhotoUpload(
  contentType: string,
  sizeBytes: number,
): Promise<Result<UploadTicket>> {
  try {
    return {
      ok: true,
      data: await api<UploadTicket>('/seller/uploads', {
        method: 'POST',
        body: { contentType, sizeBytes },
      }),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function attachPhoto(
  productId: string,
  storageKey: string,
  alt: string,
): Promise<Result<null>> {
  if (!UUID.test(productId)) return { ok: false, error: 'Unknown listing.' };
  try {
    await api(`/seller/products/${productId}/images`, {
      method: 'POST',
      body: { storageKey, alt },
    });
    revalidatePath(`/sell/listings/${productId}`);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}
