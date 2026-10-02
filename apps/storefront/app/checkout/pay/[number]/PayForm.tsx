'use client';

import { type PaymentSession } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
// The "pure" entry loads Stripe.js only when a Stripe payment form is shown.
import { type Stripe } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import { useState } from 'react';
import { confirmTestPayment } from './actions';

let stripePromise: Promise<Stripe | null> | null = null;

export function PayForm({ session, returnPath }: { session: PaymentSession; returnPath: string }) {
  if (session.provider === 'FAKE' || !session.publishableKey) {
    return <TestPayment session={session} returnPath={returnPath} />;
  }
  stripePromise ??= loadStripe(session.publishableKey);
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: session.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#e8622c',
            borderRadius: '10px',
            fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
          },
        },
      }}
    >
      <StripePayment session={session} returnPath={returnPath} />
    </Elements>
  );
}

/** Card details go from this iframe straight to Stripe; NIXZORA only learns the result. */
function StripePayment({ session, returnPath }: { session: PaymentSession; returnPath: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${returnPath}&confirming=1` },
    });
    // Only reached when the payment fails before redirecting (e.g. card declined).
    setError(result.error?.message ?? 'The payment did not go through.');
    setPending(false);
  }

  return (
    <form onSubmit={pay} className="form">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn--primary btn--block" type="submit" disabled={!stripe || pending}>
        {pending ? 'Processing…' : `Pay ${formatMoney(session.amountCents, session.currency)}`}
      </button>
    </form>
  );
}

function TestPayment({ session, returnPath }: { session: PaymentSession; returnPath: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(outcome: 'succeeded' | 'failed') {
    setPending(true);
    setError(null);
    const result = await confirmTestPayment(session.clientSecret, outcome);
    if (!result.ok) {
      setError(result.error ?? 'The test payment failed.');
      setPending(false);
      return;
    }
    if (outcome === 'failed') {
      setError('Your card was declined (test). Try again.');
      setPending(false);
      return;
    }
    // A full page load, like Stripe's redirect: every part of the page (cart count too) is fresh.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose
    window.location.assign(`${returnPath}&confirming=1`);
  }

  return (
    <div className="test-pay">
      <strong>Test payment mode</strong>
      <p className="muted" style={{ fontSize: 14 }}>
        No payment provider is configured, so no card is needed. Add Stripe test keys to the API to
        see the real payment form.
      </p>
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="btn btn--primary btn--block"
        type="button"
        disabled={pending}
        onClick={() => run('succeeded')}
      >
        {pending
          ? 'Processing…'
          : `Pay ${formatMoney(session.amountCents, session.currency)} (test)`}
      </button>
      <button
        className="btn btn--secondary btn--block"
        type="button"
        disabled={pending}
        onClick={() => run('failed')}
      >
        Simulate a declined card
      </button>
    </div>
  );
}
