import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import {
  type CardDetails,
  type CreateIntentInput,
  type IntentStatus,
  type PaymentEvent,
  type PaymentEventType,
  type PaymentGateway,
} from './payment-gateway';

const EVENT_TYPES: Record<string, PaymentEventType> = {
  'payment_intent.succeeded': 'succeeded',
  'payment_intent.processing': 'processing',
  'payment_intent.payment_failed': 'failed',
  'payment_intent.canceled': 'canceled',
  'charge.dispute.created': 'disputed',
};

function statusOf(status: Stripe.PaymentIntent.Status): IntentStatus {
  switch (status) {
    case 'succeeded':
      return 'succeeded';
    case 'processing':
      return 'processing';
    case 'requires_action':
      return 'requires_action';
    case 'requires_payment_method':
    case 'canceled':
      return 'failed';
    default:
      return 'pending';
  }
}

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
    const saved = input.paymentMethodId ?? null;
    const params: Stripe.PaymentIntentCreateParams = {
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      receipt_email: input.email,
      description: `NIXZORA order ${input.orderNumber}`,
      metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
      ...(input.customerId ? { customer: input.customerId } : {}),
      // Kept for later charges, including while the customer is away (Subscribe & Save).
      ...(input.saveCard && input.customerId ? { setup_future_usage: 'off_session' } : {}),
      ...(saved
        ? {
            payment_method: saved,
            payment_method_types: ['card'],
            confirm: true,
            ...(input.offSession ? { off_session: true } : {}),
          }
        : { automatic_payment_methods: { enabled: true } }),
    };
    try {
      const intent = await this.stripe.paymentIntents.create(params, {
        idempotencyKey: input.idempotencyKey,
      });
      return {
        id: intent.id,
        clientSecret: intent.client_secret!,
        status: saved ? statusOf(intent.status) : ('pending' as const),
      };
    } catch (error) {
      // A declined saved card: Stripe still made the intent, and says why.
      if (error instanceof Stripe.errors.StripeCardError && error.payment_intent) {
        const intent = error.payment_intent;
        return {
          id: intent.id,
          clientSecret: intent.client_secret!,
          status:
            intent.status === 'requires_action'
              ? ('requires_action' as const)
              : ('failed' as const),
          failure: error.message,
        };
      }
      throw error;
    }
  }

  async ensureCustomer(input: { userId: string; email: string; existing: string | null }) {
    if (input.existing) return input.existing;
    const customer = await this.stripe.customers.create(
      { email: input.email, metadata: { userId: input.userId } },
      { idempotencyKey: `customer-${input.userId}` },
    );
    return customer.id;
  }

  async savedCard(paymentId: string): Promise<CardDetails | null> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentId, {
      expand: ['payment_method'],
    });
    const method = intent.payment_method;
    if (!intent.setup_future_usage || typeof method !== 'object' || !method?.card) return null;
    return {
      methodId: method.id,
      brand: method.card.brand,
      last4: method.card.last4,
      expMonth: method.card.exp_month,
      expYear: method.card.exp_year,
    };
  }

  async detachCard(methodId: string): Promise<void> {
    await this.stripe.paymentMethods.detach(methodId);
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

  async paymentRisk(paymentId: string): Promise<string | null> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentId, {
      expand: ['latest_charge'],
    });
    const charge = intent.latest_charge;
    return typeof charge === 'object' && charge ? (charge.outcome?.risk_level ?? null) : null;
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
    if (type === 'disputed') {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntent =
        typeof dispute.payment_intent === 'string'
          ? dispute.payment_intent
          : dispute.payment_intent?.id;
      if (!paymentIntent) return null;
      return {
        id: event.id,
        type,
        paymentId: paymentIntent,
        amountCents: dispute.amount,
        currency: dispute.currency.toUpperCase(),
      };
    }
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
