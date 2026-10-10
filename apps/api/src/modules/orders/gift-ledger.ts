import { ConflictException } from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * The gift card balance ledger (p10-10). A customer's balance is the sum of their entries; every
 * change happens in a transaction holding a per-customer lock, so two checkouts can't spend the
 * same dollars.
 */
export async function giftBalance(tx: Tx, userId: string, lock = false): Promise<number> {
  if (lock) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gift:${userId}`}))`;
  const sum = await tx.giftBalanceEntry.aggregate({
    where: { userId },
    _sum: { amountCents: true },
  });
  return sum._sum.amountCents ?? 0;
}

/** Spends part of the balance on an order (the caller holds the lock). */
export async function spendGiftBalance(
  tx: Tx,
  userId: string,
  orderId: string,
  cents: number,
): Promise<void> {
  if (cents > (await giftBalance(tx, userId))) {
    throw new ConflictException('Your gift card balance changed. Try again.');
  }
  await tx.giftBalanceEntry.create({
    data: { userId, kind: 'SPEND', amountCents: -cents, orderId },
  });
}

/** An order that will never be paid gives back the balance it held. Safe to call twice. */
export async function releaseGiftBalance(tx: Tx, orderId: string): Promise<number> {
  const released = await tx.payment.updateMany({
    where: {
      orderId,
      provider: 'GIFT_BALANCE',
      status: { in: ['SUCCEEDED', 'REQUIRES_ACTION'] },
      order: { status: { in: ['PENDING_PAYMENT', 'CANCELLED'] }, placedAt: null },
    },
    data: { status: 'CANCELED' },
  });
  if (!released.count) return 0;
  const spent = await tx.giftBalanceEntry.findFirst({ where: { orderId, kind: 'SPEND' } });
  if (!spent) return 0;
  await tx.giftBalanceEntry.create({
    data: {
      userId: spent.userId,
      kind: 'RELEASE',
      amountCents: -spent.amountCents,
      orderId,
      note: 'Order not paid',
    },
  });
  return -spent.amountCents;
}

/** Money refunded to the balance it was paid from. */
export async function refundToGiftBalance(
  tx: Tx,
  userId: string,
  orderId: string,
  cents: number,
  note: string,
): Promise<void> {
  await tx.giftBalanceEntry.create({
    data: { userId, kind: 'REFUND', amountCents: cents, orderId, note: note.slice(0, 200) },
  });
}
