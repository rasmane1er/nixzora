import { BadRequestException, ForbiddenException } from '@nestjs/common';
import Stripe from 'stripe';
import {
  type PayoutAccountInput,
  type PayoutAccountStatus,
  type PayoutGateway,
  type TransferInput,
} from './payout-gateway';

/**
 * Stripe Connect with Express dashboards: Stripe collects identity, tax and bank details on its
 * hosted onboarding and owns the seller's payout dashboard. NIXZORA charges shoppers on the
 * platform account and transfers each seller's share ("separate charges and transfers"), so the
 * connected account only needs the transfers capability.
 */
export class StripePayoutGateway implements PayoutGateway {
  readonly name = 'STRIPE' as const;
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly connectWebhookSecret?: string,
  ) {
    this.stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 15_000 });
  }

  /**
   * account.updated from the Connect webhook endpoint. Only the account id is used: the caller
   * reads the current status, so events arriving late or out of order change nothing.
   */
  accountFromWebhook(rawBody: Buffer, signature: string | undefined): string | null {
    if (!this.connectWebhookSecret) {
      throw new ForbiddenException(
        'Connect webhooks are not set up (STRIPE_CONNECT_WEBHOOK_SECRET).',
      );
    }
    if (!signature) throw new BadRequestException('Missing Stripe signature.');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.connectWebhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature.');
    }
    if (event.type !== 'account.updated') return null;
    return event.account ?? (event.data.object as Stripe.Account).id;
  }

  async createAccount(input: PayoutAccountInput) {
    const account = await this.stripe.accounts.create(
      {
        country: input.country,
        email: input.email,
        business_profile: { name: input.businessName },
        capabilities: { transfers: { requested: true } },
        controller: {
          stripe_dashboard: { type: 'express' },
          fees: { payer: 'application' },
          losses: { payments: 'application' },
          requirement_collection: 'stripe',
        },
        metadata: { sellerId: input.sellerId },
      },
      { idempotencyKey: `nixzora-seller-account-${input.sellerId}` },
    );
    return { accountId: account.id };
  }

  async onboardingLink(
    accountId: string,
    urls: { returnUrl: string; refreshUrl: string },
  ): Promise<string> {
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: urls.returnUrl,
      refresh_url: urls.refreshUrl,
    });
    return link.url;
  }

  async accountStatus(accountId: string): Promise<PayoutAccountStatus> {
    const account = await this.stripe.accounts.retrieve(accountId);
    return {
      detailsSubmitted: account.details_submitted ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      requirementsDue: [
        ...(account.requirements?.currently_due ?? []),
        ...(account.requirements?.past_due ?? []),
      ].filter((field, index, all) => all.indexOf(field) === index),
    };
  }

  async transfer(input: TransferInput) {
    const transfer = await this.stripe.transfers.create(
      {
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        destination: input.accountId,
        description: input.description,
        transfer_group: `payout_${input.payoutId}`,
        metadata: { payoutId: input.payoutId },
      },
      { idempotencyKey: `nixzora-payout-${input.payoutId}` },
    );
    return { id: transfer.id };
  }
}
