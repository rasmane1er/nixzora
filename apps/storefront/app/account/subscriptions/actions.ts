'use server';

import {
  type SubscribeResult,
  SUBSCRIPTION_INTERVALS,
  type SubscriptionInterval,
} from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { accessToken } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = '/account/subscriptions';

const intervalOf = (value: unknown): SubscriptionInterval =>
  (SUBSCRIPTION_INTERVALS as readonly number[]).includes(Number(value))
    ? (Number(value) as SubscriptionInterval)
    : 30;

/** Subscribe & Save from a product page (p10-11): the first delivery is ordered at once. */
export async function subscribeTo(
  variantId: string,
  quantity: number,
  intervalDays: number,
  slug: string,
): Promise<{ error: string }> {
  if (!UUID.test(variantId)) return { error: (await getT('cart'))('chooseOption') };
  if (!(await accessToken())) redirect(`/account/login?next=/p/${slug}`);
  let result: SubscribeResult;
  try {
    result = await api<SubscribeResult>('/me/subscriptions', {
      method: 'POST',
      body: {
        variantId,
        quantity: Math.min(10, Math.max(1, Math.trunc(quantity) || 1)),
        intervalDays: intervalOf(intervalDays),
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'SUBSCRIBE_SETUP') {
      return { error: (await getT('subscribe'))('needsSetup') };
    }
    return { error: errorMessage(error) };
  }
  const order = result.order;
  if (!order) redirect(PAGE);
  const token = `token=${order.accessToken}`;
  if (order.paid) redirect(`/orders/${order.orderNumber}?${token}&placed=1`);
  const problem = order.paymentProblem ? `&error=${encodeURIComponent(order.paymentProblem)}` : '';
  redirect(`/checkout/pay/${order.orderNumber}?${token}${problem}`);
}

async function perform(call: () => Promise<unknown>, notice: 'updated' | 'cancelled') {
  const t = await getT('subscribe');
  try {
    await call();
  } catch (error) {
    redirect(`${PAGE}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?notice=${encodeURIComponent(t(notice))}`);
}

export async function updateSubscription(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  const action = String(form.get('action') ?? 'save');
  const body =
    action === 'skip'
      ? { skipNext: true }
      : action === 'pause'
        ? { status: 'PAUSED' }
        : action === 'resume'
          ? { status: 'ACTIVE' }
          : {
              quantity: Math.min(10, Math.max(1, Number(form.get('quantity')) || 1)),
              intervalDays: intervalOf(form.get('intervalDays')),
            };
  await perform(() => api(`/me/subscriptions/${id}`, { method: 'PATCH', body }), 'updated');
}

export async function cancelSubscription(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  await perform(() => api(`/me/subscriptions/${id}`, { method: 'DELETE' }), 'cancelled');
}
