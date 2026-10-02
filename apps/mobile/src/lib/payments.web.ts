import type { Address, PaymentSession } from '@nixzora/validation';
import { api } from './api';

export type PayResult =
  { outcome: 'paid' } | { outcome: 'canceled' } | { outcome: 'failed'; message: string };

export type Payer = { email: string; address: Address };

/** Web preview of the app: test payments only. Card payments on the web use the storefront. */
export async function pay(session: PaymentSession, _payer: Payer): Promise<PayResult> {
  if (session.provider !== 'FAKE') {
    return { outcome: 'failed', message: 'Pay in the NIXZORA app or on the website.' };
  }
  if (!globalThis.confirm?.('Test payment: no card is charged. Pay now?')) {
    return { outcome: 'canceled' };
  }
  await api.checkout.fakeConfirm(session.clientSecret, 'succeeded');
  return { outcome: 'paid' };
}
