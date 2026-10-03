import 'server-only';
import { redirect } from 'next/navigation';
import { api, ApiError } from './api';

/** Loads account data, sending signed-out visitors to sign in and back here afterwards. */
export async function accountApi<T>(path: string, next: string): Promise<T> {
  try {
    return await api<T>(path);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect(`/account/login?next=${encodeURIComponent(next)}`);
    }
    throw error;
  }
}

export const ORDER_STATUS_TEXT: Record<string, string> = {
  PENDING_PAYMENT: 'Waiting for payment',
  PAID: 'Preparing your order',
  FULFILLING: 'Preparing to ship',
  SHIPPED: 'On its way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  PARTIALLY_REFUNDED: 'Delivered · partly refunded',
  REFUNDED: 'Refunded',
};

export const RETURN_STATUS_TEXT: Record<string, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved: send it back',
  REJECTED: 'Not accepted',
  RECEIVED: 'Received',
  REFUNDED: 'Refunded',
};

export const day = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));
