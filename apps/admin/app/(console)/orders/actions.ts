'use server';

import { api } from '@/lib/api';
import { cents, checked, perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

const MESSAGES = {
  start: 'noticePacking',
  ship: 'noticeShipped',
  deliver: 'noticeDelivered',
  cancel: 'noticeCancelled',
} as const;

export async function fulfill(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const action = text(form, 'action') ?? '';
  const t = await getT('opsOrders');
  const body =
    action === 'ship'
      ? { action, carrier: text(form, 'carrier'), trackingNumber: text(form, 'trackingNumber') }
      : action === 'cancel'
        ? { action, reason: text(form, 'reason') }
        : { action };
  await perform(
    `/orders/${id}`,
    () => api(`/admin/orders/${id}/fulfillment`, { method: 'POST', body }),
    t(
      Object.hasOwn(MESSAGES, action)
        ? MESSAGES[action as keyof typeof MESSAGES]
        : 'noticeOrderUpdated',
    ),
  );
}

export async function refund(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsOrders');
  await perform(
    `/orders/${id}`,
    () =>
      api(`/admin/orders/${id}/refunds`, {
        method: 'POST',
        body: { amountCents: cents(form, 'amount'), reason: text(form, 'reason'), restock: [] },
      }),
    t('noticeRefunded'),
  );
}

export async function buyLabel(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsOrders');
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
    t('noticeLabelBought'),
  );
}

export async function decideReturn(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const action = text(form, 'action') ?? '';
  const back = text(form, 'back') ?? '/returns';
  const t = await getT('opsOrders');
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
      ? t('noticeReturnReceived')
      : action === 'approve'
        ? t('noticeReturnApproved')
        : t('noticeReturnRejected'),
  );
}
