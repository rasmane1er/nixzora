import 'server-only';
import { type Translate } from '@nixzora/i18n';
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

const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'FULFILLING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;

const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED'] as const;

/** "On its way" for SHIPPED, in the visitor's language; unknown statuses show as stored. */
export function orderStatusText(t: Translate<'accountActivity'>, status: string): string {
  return (ORDER_STATUSES as readonly string[]).includes(status)
    ? t(`orderStatus_${status as (typeof ORDER_STATUSES)[number]}`)
    : status;
}

/** "Approved: send it back" for APPROVED, in the visitor's language. */
export function returnStatusText(t: Translate<'accountActivity'>, status: string): string {
  return (RETURN_STATUSES as readonly string[]).includes(status)
    ? t(`returnStatus_${status as (typeof RETURN_STATUSES)[number]}`)
    : status;
}
