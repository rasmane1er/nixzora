'use server';

import { type CheckoutResponse, GiftCardPurchaseSchema } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { accessToken } from '@/lib/session';

export type GiftState = { error?: string; values?: Record<string, string> };

const FIELDS = ['amount', 'custom', 'recipientName', 'recipientEmail', 'senderName', 'message'];

/** Buys an e-gift card (p10-10), then on to the payment form. */
export async function buyGiftCard(_: GiftState, form: FormData): Promise<GiftState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? '').trim()]));
  if (!(await accessToken())) redirect('/account/login?next=/gift-cards');
  const dollars = values.amount === 'custom' ? Number(values.custom) : Number(values.amount);
  const parsed = GiftCardPurchaseSchema.safeParse({
    amountCents: Math.round(dollars * 100),
    recipientEmail: values.recipientEmail,
    recipientName: values.recipientName,
    senderName: values.senderName,
    message: values.message || null,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { values, error: `${String(issue?.path[0] ?? '')}: ${issue?.message ?? ''}` };
  }
  let checkout: CheckoutResponse;
  try {
    checkout = await api<CheckoutResponse>('/gift-cards/checkout', {
      method: 'POST',
      body: parsed.data,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect('/account/login?next=/gift-cards');
    }
    return { values, error: errorMessage(error) };
  }
  redirect(`/checkout/pay/${checkout.orderNumber}?token=${checkout.accessToken}`);
}
