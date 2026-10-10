'use server';

import {
  type MyPlus,
  type PlusJoinResult,
  PlusJoinSchema,
  PlusUpdateSchema,
} from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { accessToken } from '@/lib/session';

const here = (path: string, key: 'notice' | 'error', text: string) =>
  `${path}?${key}=${encodeURIComponent(text)}`;

/** Joins NIXZORA Plus (p10-15): the trial starts at once; a paid start goes to the pay page. */
export async function joinPlus(form: FormData): Promise<void> {
  if (!(await accessToken())) redirect('/account/login?next=%2Fplus');
  const card = String(form.get('paymentCardId') ?? '');
  const parsed = PlusJoinSchema.safeParse({
    plan: form.get('plan'),
    paymentCardId: card && card !== 'new' ? card : null,
  });
  if (!parsed.success) redirect(here('/plus', 'error', parsed.error.issues[0]?.message ?? ''));
  const t = await getT('plus');
  let result: PlusJoinResult;
  try {
    result = await api<PlusJoinResult>('/me/plus', { method: 'POST', body: parsed.data });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/account/login?next=%2Fplus');
    redirect(here('/plus', 'error', errorMessage(error)));
  }
  const checkout = result.checkout;
  if (!checkout) redirect(here('/account/plus', 'notice', t('joinedTrial')));
  if (checkout.paid) redirect(here('/account/plus', 'notice', t('joinedPaid')));
  const problem = checkout.paymentProblem
    ? `&error=${encodeURIComponent(checkout.paymentProblem)}`
    : '';
  redirect(`/checkout/pay/${checkout.orderNumber}?token=${checkout.accessToken}${problem}`);
}

/** Plan, card, leaving or staying. */
export async function updatePlus(form: FormData): Promise<void> {
  const raw: Record<string, unknown> = {};
  const plan = form.get('plan');
  if (plan) raw.plan = plan;
  const leave = form.get('cancelAtPeriodEnd');
  if (leave) raw.cancelAtPeriodEnd = leave === 'true';
  const card = form.get('paymentCardId');
  if (card !== null) raw.paymentCardId = card === 'default' ? null : String(card);
  const parsed = PlusUpdateSchema.safeParse(raw);
  if (!parsed.success)
    redirect(here('/account/plus', 'error', parsed.error.issues[0]?.message ?? ''));
  const t = await getT('plus');
  try {
    await api<MyPlus>('/me/plus', { method: 'PATCH', body: parsed.data });
  } catch (error) {
    redirect(here('/account/plus', 'error', errorMessage(error)));
  }
  revalidatePath('/account/plus');
  redirect(here('/account/plus', 'notice', t('updated')));
}
