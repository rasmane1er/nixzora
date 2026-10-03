import { createHash } from 'node:crypto';
import {
  type PayoutAccountInput,
  type PayoutAccountStatus,
  type PayoutGateway,
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
}
