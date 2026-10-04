import { payoutStatusChange } from './payout-status';

const status = (
  payoutsEnabled: boolean,
  requirementsDue: string[] = [],
  detailsSubmitted = true,
) => ({
  payoutsEnabled,
  requirementsDue,
  detailsSubmitted,
});

describe('payoutStatusChange', () => {
  it('tells the seller when payouts start', () => {
    expect(payoutStatusChange(status(false, ['external_account']), status(true))).toBe('verified');
  });

  it('asks for action when payouts stop or the provider wants something new', () => {
    expect(
      payoutStatusChange(status(true), status(false, ['individual.verification.document'])),
    ).toBe('action_needed');
    expect(payoutStatusChange(status(true), status(true, ['company.tax_id']))).toBe(
      'action_needed',
    );
  });

  it('stays quiet when nothing changed, or while onboarding is still in progress', () => {
    expect(payoutStatusChange(status(true), status(true))).toBeNull();
    expect(payoutStatusChange(status(true, ['a']), status(true, ['a']))).toBeNull();
    expect(
      payoutStatusChange(status(false, ['a'], false), status(false, ['a', 'b'], false)),
    ).toBeNull();
  });
});
