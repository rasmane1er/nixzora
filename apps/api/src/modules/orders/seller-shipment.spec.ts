import { type Prisma } from '../../generated/prisma/client';
import { AWAITING_CARRIER_SCAN, verifySellerShipment } from './marketplace';

const DAY = 86_400_000;

function fakeTx(parts: object[]) {
  const tx = {
    sellerOrder: {
      findMany: jest.fn(async () => parts),
      update: jest.fn(async () => ({})),
    },
    sellerLedgerEntry: { updateMany: jest.fn(async () => ({ count: 1 })) },
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
}

const shippedAt = new Date('2027-03-01T12:00:00Z');
const part = (overrides: object = {}) => ({
  id: 'part-1',
  status: 'SHIPPED',
  shippedAt,
  trackingVerifiedAt: null,
  seller: { payoutHoldDays: 14 },
  ...overrides,
});

describe('verifySellerShipment', () => {
  it('on the first scan, starts the earnings hold from the day it shipped', async () => {
    const { tx, client } = fakeTx([part()]);
    const at = new Date('2027-03-03T09:00:00Z');
    expect(await verifySellerShipment(client, '9400abc', false, at)).toBe(1);
    expect(tx.sellerOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ trackingNumber: '9400ABC' }) }),
    );
    expect(tx.sellerOrder.update).toHaveBeenCalledWith({
      where: { id: 'part-1' },
      data: { trackingVerifiedAt: at },
    });
    expect(tx.sellerLedgerEntry.updateMany).toHaveBeenCalledWith({
      where: { idempotencyKey: 'sale:part-1', availableAt: AWAITING_CARRIER_SCAN },
      data: { availableAt: new Date(shippedAt.getTime() + 14 * DAY) },
    });
  });

  it('marks a delivered part delivered, and does not verify twice', async () => {
    const { tx, client } = fakeTx([part({ trackingVerifiedAt: shippedAt })]);
    expect(await verifySellerShipment(client, '9400ABC', true)).toBe(1);
    expect(tx.sellerLedgerEntry.updateMany).not.toHaveBeenCalled();
    expect(tx.sellerOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DELIVERED' }) }),
    );
  });

  it('changes nothing for a tracking number no seller used', async () => {
    const { tx, client } = fakeTx([]);
    expect(await verifySellerShipment(client, 'NOPE', true)).toBe(0);
    expect(tx.sellerOrder.update).not.toHaveBeenCalled();
  });
});
