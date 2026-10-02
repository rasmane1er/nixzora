import type { Address, PaymentSession } from '@nixzora/validation';
import {
  handleURLCallback,
  initPaymentSheet,
  initStripe,
  PaymentSheetError,
  presentPaymentSheet,
} from '@stripe/stripe-react-native';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import { api } from './api';
import { APP_VARIANT, MERCHANT_ID } from './config';

export type PayResult =
  { outcome: 'paid' } | { outcome: 'canceled' } | { outcome: 'failed'; message: string };

export type Payer = { email: string; address: Address };

/** Return address for bank (3-D Secure) pages opened during payment. */
const RETURN_URL = Linking.createURL('stripe-redirect');

Linking.addEventListener('url', ({ url }) => {
  if (url.includes('stripe-redirect')) void handleURLCallback(url);
});

/**
 * Collects payment for an order with Stripe's PaymentSheet: saved cards, Apple Pay and
 * Google Pay. The order is marked paid by the Stripe webhook, never by the app.
 */
export async function pay(session: PaymentSession, payer: Payer): Promise<PayResult> {
  if (session.provider === 'FAKE') return testPayment(session);
  if (!session.publishableKey) return { outcome: 'failed', message: 'Payments are not set up.' };

  await initStripe({
    publishableKey: session.publishableKey,
    merchantIdentifier: MERCHANT_ID,
    urlScheme: Linking.createURL('').replace(/:\/\/.*$/, ''),
  });
  const { address } = payer;
  const init = await initPaymentSheet({
    merchantDisplayName: 'NIXZORA',
    paymentIntentClientSecret: session.clientSecret,
    returnURL: RETURN_URL,
    defaultBillingDetails: {
      email: payer.email,
      name: address.fullName,
      phone: address.phone,
      address: {
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.region,
        postalCode: address.postalCode,
        country: address.country,
      },
    },
    applePay: { merchantCountryCode: 'US' },
    googlePay: {
      merchantCountryCode: 'US',
      currencyCode: session.currency,
      testEnv: APP_VARIANT !== 'production',
    },
    allowsDelayedPaymentMethods: false,
  });
  if (init.error) return { outcome: 'failed', message: init.error.message };

  const result = await presentPaymentSheet();
  if (!result.error) return { outcome: 'paid' };
  if (result.error.code === PaymentSheetError.Canceled) return { outcome: 'canceled' };
  return { outcome: 'failed', message: result.error.message };
}

/** Development builds against an API with PAYMENTS_PROVIDER=fake: no card, no money. */
function testPayment(session: PaymentSession): Promise<PayResult> {
  return new Promise((resolve) => {
    const confirm = (outcome: 'succeeded' | 'failed') => async () => {
      try {
        await api.checkout.fakeConfirm(session.clientSecret, outcome);
        resolve(
          outcome === 'succeeded'
            ? { outcome: 'paid' }
            : { outcome: 'failed', message: 'The test card was declined.' },
        );
      } catch {
        resolve({ outcome: 'failed', message: 'The test payment did not go through.' });
      }
    };
    Alert.alert('Test payment', 'This server uses test payments. No card is charged.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve({ outcome: 'canceled' }) },
      { text: 'Decline', style: 'destructive', onPress: confirm('failed') },
      { text: 'Pay', style: 'default', onPress: confirm('succeeded') },
    ]);
  });
}
