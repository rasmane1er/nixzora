/**
 * The seam between checkout and a payment provider (ADR-0003). Orders and checkout only
 * talk to this interface; Stripe is one implementation, the fake gateway another.
 */
export type GatewayName = 'STRIPE' | 'FAKE';

export type CreateIntentInput = {
  amountCents: number;
  currency: string;
  orderId: string;
  orderNumber: string;
  email: string;
  /** Same key → same intent, so a retried checkout request never charges twice. */
  idempotencyKey: string;
};

/** "disputed": the card holder opened a chargeback (ADR-0024). */
export type PaymentEventType = 'succeeded' | 'processing' | 'failed' | 'canceled' | 'disputed';

/** A provider webhook, verified and reduced to what NIXZORA needs. */
export type PaymentEvent = {
  /** Provider event id, used to ignore duplicates. */
  id: string;
  type: PaymentEventType;
  paymentId: string;
  amountCents: number;
  currency: string;
};

export interface PaymentGateway {
  readonly name: GatewayName;
  /** Browser key for the payment form (null when the provider needs none). */
  readonly publishableKey: string | null;
  createIntent(input: CreateIntentInput): Promise<{ id: string; clientSecret: string }>;
  clientSecret(paymentId: string): Promise<string>;
  cancel(paymentId: string): Promise<void>;
  refund(
    paymentId: string,
    amountCents: number,
    reason: string,
  ): Promise<{ id: string; status: string }>;
  /**
   * The provider's own fraud verdict on a succeeded payment ("normal", "elevated", "highest"),
   * when it has one (Stripe Radar). Optional: null means no opinion.
   */
  paymentRisk?(paymentId: string): Promise<string | null>;
  /** Verifies the signature. Throws on a forged payload; returns null for event types we ignore. */
  parseWebhook(rawBody: Buffer, signature: string | undefined): PaymentEvent | null;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
