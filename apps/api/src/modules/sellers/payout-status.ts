import { type PayoutAccountStatus } from '../payments/payout-gateway';

/**
 * What a change in a seller's payout verification means for them (unit-tested):
 * - "verified": the provider now releases money to their bank;
 * - "action_needed": payouts stopped, or the provider started asking for something new;
 * - null: nothing the seller needs to hear about.
 */
export function payoutStatusChange(
  before: PayoutAccountStatus,
  after: PayoutAccountStatus,
): 'verified' | 'action_needed' | null {
  if (!before.payoutsEnabled && after.payoutsEnabled) return 'verified';
  if (before.payoutsEnabled && !after.payoutsEnabled) return 'action_needed';
  const newlyDue = after.requirementsDue.filter((field) => !before.requirementsDue.includes(field));
  // Only for a store that had finished onboarding: during onboarding everything is "due".
  if (before.detailsSubmitted && newlyDue.length) return 'action_needed';
  return null;
}
