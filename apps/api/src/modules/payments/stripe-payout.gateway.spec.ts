import Stripe from 'stripe';
import { StripePayoutGateway } from './stripe-payout.gateway';

const SECRET = 'whsec_test_connect_secret';
const stripe = new Stripe('sk_test_x');

function signed(event: object, secret = SECRET) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { body: Buffer.from(payload), signature };
}

const accountUpdated = {
  id: 'evt_1',
  object: 'event',
  type: 'account.updated',
  account: 'acct_123',
  data: { object: { id: 'acct_123', object: 'account', payouts_enabled: true } },
};

describe('StripePayoutGateway.accountFromWebhook', () => {
  const gateway = new StripePayoutGateway('sk_test_x', SECRET);

  it('returns the connected account of a signed account.updated event', () => {
    const { body, signature } = signed(accountUpdated);
    expect(gateway.accountFromWebhook(body, signature)).toBe('acct_123');
  });

  it('ignores other event types', () => {
    const { body, signature } = signed({ ...accountUpdated, type: 'payout.paid' });
    expect(gateway.accountFromWebhook(body, signature)).toBeNull();
  });

  it('refuses a missing or forged signature', () => {
    const { body } = signed(accountUpdated);
    expect(() => gateway.accountFromWebhook(body, undefined)).toThrow('Missing');
    const forged = signed(accountUpdated, 'whsec_someone_else');
    expect(() => gateway.accountFromWebhook(body, forged.signature)).toThrow('Invalid');
  });

  it('refuses everything when the Connect endpoint is not set up', () => {
    const { body, signature } = signed(accountUpdated);
    expect(() => new StripePayoutGateway('sk_test_x').accountFromWebhook(body, signature)).toThrow(
      'not set up',
    );
  });
});
