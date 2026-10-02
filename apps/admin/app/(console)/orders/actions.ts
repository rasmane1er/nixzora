'use server';

import { api } from '@/lib/api';
import { cents, checked, perform, text, uuidField } from '@/lib/forms';

const MESSAGES: Record<string, string> = {
  start: 'Marked as packing.',
  ship: 'Marked as shipped. The customer has been emailed.',
  deliver: 'Marked as delivered.',
  cancel: 'Order cancelled.',
};

export async function fulfill(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const action = text(form, 'action') ?? '';
  const body =
    action === 'ship'
      ? { action, carrier: text(form, 'carrier'), trackingNumber: text(form, 'trackingNumber') }
      : action === 'cancel'
        ? { action, reason: text(form, 'reason') }
        : { action };
  await perform(
    `/orders/${id}`,
    () => api(`/admin/orders/${id}/fulfillment`, { method: 'POST', body }),
    MESSAGES[action] ?? 'Order updated.',
  );
}

export async function refund(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  await perform(
    `/orders/${id}`,
    () =>
      api(`/admin/orders/${id}/refunds`, {
        method: 'POST',
        body: { amountCents: cents(form, 'amount'), reason: text(form, 'reason'), restock: [] },
      }),
    'Refund issued. The customer has been emailed.',
  );
}

export async function buyLabel(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const num = (name: string) => {
    const value = Number(text(form, name));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  await perform(
    `/orders/${id}`,
    () =>
      api(`/admin/orders/${id}/label`, {
        method: 'POST',
        body: {
          lengthIn: num('lengthIn'),
          widthIn: num('widthIn'),
          heightIn: num('heightIn'),
          weightOz: num('weightOz'),
        },
      }),
    'Label bought and order shipped. Print the label from the Shipping card.',
  );
}

export async function decideReturn(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const action = text(form, 'action') ?? '';
  const back = text(form, 'back') ?? '/returns';
  const body =
    action === 'receive'
      ? { action, restock: checked(form, 'restock') }
      : action === 'reject'
        ? { action, note: text(form, 'note') }
        : { action, note: text(form, 'note') };
  await perform(
    back,
    () => api(`/admin/returns/${id}/decision`, { method: 'POST', body }),
    action === 'receive'
      ? 'Return received and refunded.'
      : action === 'approve'
        ? 'Return approved. The customer has the return address.'
        : 'Return rejected.',
  );
}
