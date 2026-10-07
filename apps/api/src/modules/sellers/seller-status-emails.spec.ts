import { SellerStatusEmails } from './seller-status-emails';

type Handler = (event: { aggregateId: string; payload: Record<string, unknown> }) => unknown;

function setup(seller: Record<string, unknown> | null, language = 'en') {
  const handlers = new Map<string, Handler>();
  const sent: { to: string; subject: string; text: string; template: string }[] = [];
  const emails = new SellerStatusEmails(
    { seller: { findUnique: async () => seller } } as never,
    { ownerLocale: async () => language } as never,
    { on: (type: string, handler: Handler) => handlers.set(type, handler) } as never,
    {
      trySend: async (message: (typeof sent)[number]) => {
        sent.push(message);
        return true;
      },
    } as never,
    { get: () => 'https://staging.nixzora.com/' } as never,
  );
  emails.onModuleInit();
  const fire = async (type: string, payload: Record<string, unknown> = {}) =>
    handlers.get(type)!({ aggregateId: 's1', payload });
  return { sent, fire };
}

const store = {
  id: 's1',
  displayName: 'Brightline Audio',
  handle: 'brightline-audio1',
  contactEmail: 'owner@example.com',
  statusReason: null,
};

describe('SellerStatusEmails', () => {
  it('confirms a new application and points to the seller portal', async () => {
    const { sent, fire } = setup(store);
    await fire('seller.applied');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('owner@example.com');
    expect(sent[0]!.subject).toBe('We received your application for Brightline Audio');
    expect(sent[0]!.text).toContain('https://staging.nixzora.com/sell');
    expect(sent[0]!.template).toBe('sellers.applied');
  });

  it('tells an approved store where it lives, and a reopened one that it is back', async () => {
    const { sent, fire } = setup(store);
    await fire('seller.status.active', { from: 'PENDING' });
    await fire('seller.status.active', { from: 'SUSPENDED' });
    expect(sent[0]!.subject).toBe('Brightline Audio is open on NIXZORA');
    expect(sent[0]!.text).toContain('https://staging.nixzora.com/s/brightline-audio1');
    expect(sent[1]!.template).toBe('sellers.reinstated');
  });

  it('includes the reason on a rejection when staff gave one', async () => {
    const withReason = setup({ ...store, statusReason: ' Documents did not match. ' });
    await withReason.fire('seller.status.rejected');
    expect(withReason.sent[0]!.text).toContain('Reason: Documents did not match.');

    const without = setup(store);
    await without.fire('seller.status.suspended');
    expect(without.sent[0]!.text).not.toContain('Reason');
    expect(without.sent[0]!.subject).toBe('Brightline Audio is paused');
  });

  it('writes in the owner’s language', async () => {
    const { sent, fire } = setup(store, 'fr');
    await fire('seller.applied');
    expect(sent[0]!.subject).toBe('Nous avons reçu votre candidature pour Brightline Audio');
  });

  it('does nothing for a store that no longer exists', async () => {
    const { sent, fire } = setup(null);
    await fire('seller.applied');
    expect(sent).toHaveLength(0);
  });
});
