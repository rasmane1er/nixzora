import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import {
  type CreateIntentInput,
  type PaymentEvent,
  type PaymentEventType,
  type PaymentGateway,
} from './payment-gateway';

const EVENT_TYPES: Record<string, PaymentEventType> = {
  'payment_intent.succeeded': 'succeeded',
  'payment_intent.processing': 'processing',
  'payment_intent.payment_failed': 'failed',
  'payment_intent.canceled': 'canceled',
};

/**
 * Stripe Payment Element flow: the server creates a PaymentIntent, the browser confirms it
 * with Stripe directly (card data never touches NIXZORA), and a signed webhook reports the result.
 */
export class StripeGateway implements PaymentGateway {
  readonly name = 'STRIPE' as const;
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    readonly publishableKey: string,
    private readonly webhookSecret: string,
  ) {
    this.stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 15_000 });
  }

  async createIntent(input: CreateIntentInput) {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: input.email,
        description: `NIXZORA order ${input.orderNumber}`,
        metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return { id: intent.id, clientSecret: intent.client_secret! };
  }

  async clientSecret(paymentId: string): Promise<string> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentId);
    return intent.client_secret!;
  }

  async cancel(paymentId: string): Promise<void> {
    await this.stripe.paymentIntents.cancel(paymentId);
  }

  async refund(paymentId: string, amountCents: number, reason: string) {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentId,
      amount: amountCents,
      metadata: { reason },
    });
    return { id: refund.id, status: refund.status ?? 'pending' };
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): PaymentEvent | null {
    if (!signature) throw new BadRequestException('Missing Stripe signature.');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature.');
    }
    const type = EVENT_TYPES[event.type];
    if (!type) return null;
    const intent = event.data.object as Stripe.PaymentIntent;
    return {
      id: event.id,
      type,
      paymentId: intent.id,
      amountCents: intent.amount,
      currency: intent.currency.toUpperCase(),
    };
  }
}
