import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import {
  type CreateIntentInput,
  type PaymentEvent,
  type PaymentEventType,
  type PaymentGateway,
} from './payment-gateway';

/**
 * Development and test gateway: no network, no card. The storefront shows "Pay (test)" buttons
 * that call POST /api/v1/payments/fake/confirm, which produces the same events as Stripe.
 * Environment validation refuses it in production.
 */
export class FakeGateway implements PaymentGateway {
  readonly name = 'FAKE' as const;
  readonly publishableKey = null;
  private readonly intents = new Map<string, string>();

  static secretFor(paymentId: string): string {
    return `${paymentId}_secret_${createHash('sha256').update(`nixzora-fake:${paymentId}`).digest('hex').slice(0, 24)}`;
  }

  async createIntent(input: CreateIntentInput) {
    const existing = this.intents.get(input.idempotencyKey);
    const id = existing ?? `fake_pi_${randomUUID().replace(/-/g, '')}`;
    this.intents.set(input.idempotencyKey, id);
    return { id, clientSecret: FakeGateway.secretFor(id) };
  }

  async clientSecret(paymentId: string): Promise<string> {
    return FakeGateway.secretFor(paymentId);
  }

  async cancel(): Promise<void> {}

  /** Lets tests play Stripe Radar: the confirm endpoint can mark a payment as risky. */
  private readonly risk = new Map<string, string>();

  setPaymentRisk(paymentId: string, level: string): void {
    this.risk.set(paymentId, level);
  }

  async paymentRisk(paymentId: string): Promise<string | null> {
    return this.risk.get(paymentId) ?? null;
  }

  async refund() {
    return { id: `fake_re_${randomUUID().replace(/-/g, '')}`, status: 'succeeded' };
  }

  /** Builds the event the confirm endpoint feeds into the same code path as real webhooks. */
  event(
    clientSecret: string,
    outcome: PaymentEventType,
    amountCents: number,
    currency: string,
  ): PaymentEvent {
    const paymentId = clientSecret.split('_secret_')[0] ?? '';
    if (FakeGateway.secretFor(paymentId) !== clientSecret) {
      throw new BadRequestException('Unknown test payment.');
    }
    return { id: `fake_evt_${randomUUID()}`, type: outcome, paymentId, amountCents, currency };
  }

  parseWebhook(): PaymentEvent | null {
    throw new BadRequestException('The test gateway has no webhooks.');
  }
}
