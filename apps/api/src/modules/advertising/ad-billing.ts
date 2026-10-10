import { type PrismaClient } from '../../generated/prisma/client';

type Db = Pick<PrismaClient, '$transaction' | 'adClick'>;

export type Settlement = { clicks: number; creditUsedCents: number; chargedCents: number };

/**
 * Charges a store's unbilled ad clicks (p10-01): ad credit first, the rest as one AD_SPEND entry
 * in its earnings ledger, so the cost comes out of the next payout. Runs hourly and before every
 * payout. Safe to repeat: the clicks are marked billed in the same transaction, under a per-store
 * lock, and the ledger entry's idempotency key is the last click it covers.
 */
export async function settleAdSpend(
  prisma: Db,
  sellerId: string,
  now = new Date(),
): Promise<Settlement> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ads-billing:${sellerId}`}))`;
    const clicks = await tx.adClick.findMany({
      where: { sellerId, billedAt: null, createdAt: { lte: now } },
      select: { id: true, costCents: true },
      orderBy: { id: 'asc' },
    });
    if (!clicks.length) return { clicks: 0, creditUsedCents: 0, chargedCents: 0 };

    const total = clicks.reduce((sum, click) => sum + click.costCents, 0);
    const seller = await tx.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: { adCreditCents: true },
    });
    const creditUsedCents = Math.min(Math.max(seller.adCreditCents, 0), total);
    const chargedCents = total - creditUsedCents;
    const paid = clicks.filter((click) => click.costCents > 0).length;

    if (creditUsedCents > 0) {
      await tx.seller.update({
        where: { id: sellerId },
        data: { adCreditCents: { decrement: creditUsedCents } },
      });
    }
    if (chargedCents > 0) {
      await tx.sellerLedgerEntry.create({
        data: {
          sellerId,
          type: 'AD_SPEND',
          amountCents: -chargedCents,
          availableAt: now,
          description:
            creditUsedCents > 0
              ? `Sponsored products: ${paid} clicks (after ${money(creditUsedCents)} ad credit)`
              : `Sponsored products: ${paid} clicks`,
          idempotencyKey: `ads:${sellerId}:${clicks[clicks.length - 1]!.id}`,
        },
      });
    }
    await tx.adClick.updateMany({
      where: { id: { in: clicks.map((click) => click.id) } },
      data: { billedAt: now },
    });
    return { clicks: paid, creditUsedCents, chargedCents };
  });
}

/** Settles every store with unbilled clicks. */
export async function settleAllAdSpend(prisma: Db, now = new Date()): Promise<number> {
  const sellers = await prisma.adClick.findMany({
    where: { billedAt: null, createdAt: { lte: now } },
    distinct: ['sellerId'],
    select: { sellerId: true },
  });
  for (const { sellerId } of sellers) await settleAdSpend(prisma, sellerId, now);
  return sellers.length;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
