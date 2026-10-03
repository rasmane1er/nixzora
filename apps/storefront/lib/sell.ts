import 'server-only';
import { type CategoryNode, type SellerMeResponse, type SellerView } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { api, ApiError, catalog } from './api';

/** The signed-in customer's store (or null). Sends signed-out visitors to sign in. */
export async function sellerMe(next = '/sell'): Promise<SellerMeResponse> {
  try {
    return await api<SellerMeResponse>('/seller/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/account/login?next=${encodeURIComponent(next)}`);
    }
    throw error;
  }
}

/** Portal pages past the landing page need a store; without one, back to /sell to apply. */
export async function requireSeller(next: string): Promise<SellerView> {
  const { seller } = await sellerMe(next);
  if (!seller) redirect('/sell');
  return seller;
}

export const SELLER_STATUS_LABEL: Record<SellerView['status'], string> = {
  PENDING: 'Waiting for approval',
  ACTIVE: 'Approved',
  SUSPENDED: 'Suspended',
  REJECTED: 'Not approved',
};

export const LISTING_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'In review',
  ACTIVE: 'Live',
  ARCHIVED: 'Archived',
};

export type CategoryOption = { id: string; slug: string; label: string };

/** Category tree flattened for a <select>: "Audio › Speakers". */
export async function categoryOptions(): Promise<CategoryOption[]> {
  const tree = await catalog.categories();
  const walk = (nodes: CategoryNode[], trail: string[]): CategoryOption[] =>
    nodes.flatMap((node) => {
      const path = [...trail, node.name];
      return [
        { id: node.id, slug: node.slug, label: path.join(' › ') },
        ...walk(node.children, path),
      ];
    });
  return walk(tree, []);
}

/** Specs as editable text: one "name: value" per line. */
export function specsText(attributes: Record<string, string | number | boolean>): string {
  return Object.entries(attributes)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');
}
