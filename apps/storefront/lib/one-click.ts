import 'server-only';
import { type MeResponse, type PaymentCardView, type SavedAddress } from '@nixzora/validation';
import { api } from './api';

export type OneClickSetup = {
  email: string;
  card: PaymentCardView;
  address: SavedAddress;
};

/**
 * What 1-click uses (p10-09): the default saved card and the default (or first) address, or
 * null when the shopper is signed out or has not saved both yet.
 */
export async function oneClickSetup(): Promise<OneClickSetup | null> {
  const [me, cards, addresses] = await Promise.all([
    api<MeResponse>('/auth/me').catch(() => null),
    api<PaymentCardView[]>('/me/payment-cards').catch((): PaymentCardView[] => []),
    api<SavedAddress[]>('/me/addresses').catch((): SavedAddress[] => []),
  ]);
  const card = cards.find((c) => c.isDefault && !c.expired) ?? cards.find((c) => !c.expired);
  const address = addresses.find((a) => a.isDefaultShipping) ?? addresses[0];
  if (!me || !card || !address) return null;
  return { email: me.email, card, address };
}
