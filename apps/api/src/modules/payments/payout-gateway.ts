/**
 * The seam between the marketplace and the provider that verifies sellers and pays them
 * (ADR-0012). Stripe Connect is one implementation; the fake gateway verifies instantly and
 * moves no money, for development, tests and the public demo.
 */
export type PayoutProviderName = 'FAKE' | 'STRIPE';

export type PayoutAccountInput = {
  sellerId: string;
  email: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  businessName: string;
};

export type PayoutAccountStatus = {
  /** The seller finished the provider's identity and bank forms. */
  detailsSubmitted: boolean;
  /** The provider will release money to the seller's bank. */
  payoutsEnabled: boolean;
  /** Fields the provider still needs, e.g. "external_account". Empty when nothing is due. */
  requirementsDue: string[];
};

export type TransferInput = {
  accountId: string;
  amountCents: number;
  currency: string;
  /** Our payout id: the provider's idempotency key, so a retried transfer is sent once. */
  payoutId: string;
  description: string;
};

export interface PayoutGateway {
  readonly name: PayoutProviderName;
  /** Creates the seller's connected account. Safe to retry: one account per seller. */
  createAccount(input: PayoutAccountInput): Promise<{ accountId: string }>;
  /**
   * A short-lived link to the provider's hosted onboarding (identity, tax and bank details).
   * NIXZORA never sees bank or identity documents.
   */
  onboardingLink(
    accountId: string,
    urls: { returnUrl: string; refreshUrl: string },
  ): Promise<string>;
  accountStatus(accountId: string): Promise<PayoutAccountStatus>;
  /** Moves money from NIXZORA's balance to the seller's connected account. */
  transfer(input: TransferInput): Promise<{ id: string }>;
}

export const PAYOUT_GATEWAY = Symbol('PAYOUT_GATEWAY');
