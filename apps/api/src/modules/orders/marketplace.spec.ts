import { allocateRefund, commissionOf, splitBySeller } from './marketplace';

/** A transaction stub that records writes. */
function fakeTx(parts: Record<string, unknown>[] = []) {
  const writes: { model: string; data: Record<string, unknown> }[] = [];
  const record =
    (model: string) =>
    async ({ data }: { data: Record<string, unknown> }) => {
      writes.push({ model, data });
      return { id: `${model}-${writes.length}`, ...data };
    };
  const tx = {
    seller: {
      findMany: async () => [
        { id: 's1', commissionBps: 1200 },
        { id: 's2', commissionBps: 800 },
      ],
    },
    sellerOrder: {
      findUnique: async () => null,
      findMany: async () => parts,
      create: record('sellerOrder'),
      update: record('sellerOrderUpdate'),
    },
    sellerLedgerEntry: { create: record('ledger'), aggregate: async () => ({ _sum: {} }) },
    outboxEvent: { create: record('outbox') },
  };
  return { tx: tx as never, writes };
}

describe('commissionOf', () => {
  it('rounds to the nearest cent', () => {
    expect(commissionOf(10000, 1200)).toBe(1200);
    expect(commissionOf(999, 1250)).toBe(125); // 124.875
  });
});

describe('splitBySeller', () => {
  it('gives each seller its items, a share of shipping, and its own commission rate', async () => {
    const { tx, writes } = fakeTx();
    await splitBySeller(tx, {
      id: 'o1',
      number: 'NX-1',
      subtotalCents: 8000,
      shippingCents: 999,
      items: [
        { sellerId: 's1', totalCents: 4000 },
        { sellerId: 's2', totalCents: 2000 },
        { sellerId: null, totalCents: 2000 }, // NIXZORA's own item keeps its share
      ],
    });
    const parts = writes.filter((w) => w.model === 'sellerOrder').map((w) => w.data);
    expect(parts).toEqual([
      expect.objectContaining({
        sellerId: 's1',
        itemsCents: 4000,
        shippingCents: 500, // 999 × 4000/8000, rounded
        commissionCents: 480,
        netCents: 4000 + 500 - 480,
      }),
      expect.objectContaining({
        sellerId: 's2',
        itemsCents: 2000,
        shippingCents: 250,
        commissionBps: 800,
        commissionCents: 160,
        netCents: 2000 + 250 - 160,
      }),
    ]);
    expect(writes.filter((w) => w.model === 'outbox')).toHaveLength(2);
  });
});

describe('allocateRefund', () => {
  const part = (sellerId: string, itemsCents: number) => ({
    id: `p-${sellerId}`,
    sellerId,
    status: 'DELIVERED',
    itemsCents,
    shippingCents: 0,
    refundedCents: 0,
    commissionBps: 1000,
  });

  it('without returned lines, shares the refund by each party’s items', async () => {
    const { tx, writes } = fakeTx([part('s1', 6000)]);
    await allocateRefund(
      tx,
      {
        id: 'o1',
        number: 'NX-1',
        items: [
          { variantId: 'a', sellerId: 's1', totalCents: 6000, unitPriceCents: 6000 },
          { variantId: 'b', sellerId: null, totalCents: 4000, unitPriceCents: 4000 },
        ],
      },
      { id: 'r1', amountCents: 1000, cancel: false },
    );
    // $10 goodwill refund: 60% is the seller's ($6), minus the 10% commission returned.
    const ledger = writes.find((w) => w.model === 'ledger')!.data;
    expect(ledger).toMatchObject({
      type: 'REFUND',
      amountCents: -540,
      idempotencyKey: 'refund:r1:p-s1',
    });
  });

  it('never debits more than the seller part is worth', async () => {
    const { tx, writes } = fakeTx([{ ...part('s1', 1000), refundedCents: 900 }]);
    await allocateRefund(
      tx,
      { id: 'o1', number: 'NX-1', items: [{ variantId: 'a', sellerId: 's1', totalCents: 1000 }] },
      { id: 'r2', amountCents: 1000, cancel: false },
    );
    expect(writes.find((w) => w.model === 'ledger')!.data.amountCents).toBe(-90); // 100 − 10%
  });
});
