import { createHash } from 'node:crypto';
import {
  type PayoutAccountInput,
  type PayoutAccountStatus,
  type PayoutGateway,
  type TransferInput,
} from './payout-gateway';

/**
 * Test-mode payouts: onboarding returns straight to NIXZORA and the account is verified at once.
 * No identity check, no bank, no money. Environment validation refuses it in production
 * unless ALLOW_TEST_PAYMENTS is set for a demo.
 */
export class FakePayoutGateway implements PayoutGateway {
  readonly name = 'FAKE' as const;

  async createAccount(input: PayoutAccountInput) {
    // Deterministic per seller, like Stripe's idempotency key: a retry gets the same account.
    const digest = createHash('sha256').update(`nixzora-fake-acct:${input.sellerId}`).digest('hex');
    return { accountId: `fake_acct_${digest.slice(0, 16)}` };
  }

  async onboardingLink(_accountId: string, urls: { returnUrl: string }): Promise<string> {
    return urls.returnUrl;
  }

  async accountStatus(): Promise<PayoutAccountStatus> {
    return { detailsSubmitted: true, payoutsEnabled: true, requirementsDue: [] };
  }

  async transfer(input: TransferInput) {
    if (!input.accountId.startsWith('fake_acct_')) {
      throw new Error('Not a test-mode account.');
    }
    // Deterministic per payout, like Stripe's idempotency key.
    const digest = createHash('sha256').update(`nixzora-fake-tr:${input.payoutId}`).digest('hex');
    return { id: `fake_tr_${digest.slice(0, 20)}` };
  }
}
