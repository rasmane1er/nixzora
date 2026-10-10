import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payments/payment-gateway';
import { refundToGiftBalance } from './gift-ledger';
import { allocateRefund } from './marketplace';

const REFUNDABLE = ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED'] as const;

export type RefundableOrder = {
  id: string;
  number: string;
  status: string;
  /** Gift card orders (p10-10) refund in full and void their cards. */
  kind?: 'GOODS' | 'GIFT_CARD' | 'PLUS';
  /** For Plus fees (p10-15): the membership a full refund ends. */
  plusMembershipId?: string | null;
  totalCents: number;
  refundedCents: number;
  items: {
    id: string;
    variantId: string | null;
    quantity: number;
    sellerId?: string | null;
    totalCents?: number;
    unitPriceCents?: number;
  }[];
};

export type RefundOptions = {
  /** Also cancel the order (it has not shipped). */
  cancel?: boolean;
  /** The return this refund settles. */
  returnId?: string;
  /** Units to put back on the shelf. */
  restock?: { variantId: string; quantity: number }[];
};

/**
 * Every refund goes through here: full (cancellation), partial (goodwill, damage) or for a
 * return. The provider refund happens first; only if it succeeds does anything change locally,
 * in one transaction with the stock and an outbox event for the customer email.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  remaining(order: Pick<RefundableOrder, 'totalCents' | 'refundedCents'>): number {
    return Math.max(0, order.totalCents - order.refundedCents);
  }

  async refund(
    order: RefundableOrder,
    amountCents: number,
    reason: string,
    options: RefundOptions = {},
  ): Promise<void> {
    if (!(REFUNDABLE as readonly string[]).includes(order.status)) {
      throw new ConflictException('This order has nothing to refund.');
    }
    const remaining = this.remaining(order);
    if (amountCents < 1 || amountCents > remaining) {
      throw new BadRequestException(
        `You can refund up to ${(remaining / 100).toFixed(2)} on this order.`,
      );
    }
    // Card first, then the gift card balance (p10-10): each gets back at most what it paid.
    const payments = await this.prisma.payment.findMany({
      where: { orderId: order.id, status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] } },
      include: { refunds: { select: { amountCents: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const card = payments.find((p) => p.provider !== 'GIFT_BALANCE');
    const gift = payments.find((p) => p.provider === 'GIFT_BALANCE');
    if (!card && !gift) throw new ConflictException('No captured payment to refund.');
    const left = (p?: (typeof payments)[number]) =>
      p ? p.amountCents - p.refunds.reduce((sum, r) => sum + r.amountCents, 0) : 0;
    const cardCents = Math.min(amountCents, Math.max(0, left(card)));
    const giftCents = amountCents - cardCents;
    if (giftCents > Math.max(0, left(gift))) {
      throw new ConflictException('This order has less left to refund than that.');
    }
    if (order.kind === 'GIFT_CARD') await this.assertGiftCardsRefundable(order, amountCents);

    let providerRefund: { id: string; status: string } | null = null;
    if (cardCents > 0 && card) {
      try {
        providerRefund = await this.gateway.refund(card.providerPaymentId, cardCents, reason);
      } catch (error) {
        this.logger.error(`Refund failed for ${order.number}: ${(error as Error).message}`);
        throw new BadGatewayException(
          'The refund could not be issued. Nothing was changed; try again.',
        );
      }
    }

    const refundedCents = order.refundedCents + amountCents;
    const full = refundedCents >= order.totalCents;
    await this.prisma.$transaction(async (tx) => {
      // Guards against two staff refunding at once from a stale page.
      const updated = await tx.order.updateMany({
        where: { id: order.id, refundedCents: order.refundedCents },
        data: {
          refundedCents,
          ...(options.cancel
            ? { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason }
            : { status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED' }),
        },
      });
      if (!updated.count) {
        // The provider refund went through; record it anyway and flag for review.
        this.logger.error(
          `Concurrent refund on ${order.number}; recording provider refund ${providerRefund?.id}.`,
        );
        await tx.order.update({
          where: { id: order.id },
          data: { refundedCents: { increment: amountCents } },
        });
      }
      if (order.kind === 'PLUS' && full && order.plusMembershipId) {
        // A refunded Plus fee (p10-15) ends the membership now.
        await tx.plusMembership.updateMany({
          where: { id: order.plusMembershipId, status: { not: 'ENDED' } },
          data: { status: 'ENDED', endedAt: new Date(), nextAttemptAt: null },
        });
      }
      if (order.kind === 'GIFT_CARD') {
        // Voided with the refund; a code redeemed a moment ago keeps its value (logged).
        await tx.giftCard.updateMany({
          where: { orderId: order.id, status: { in: ['PENDING', 'ACTIVE'] } },
          data: { status: 'VOID' },
        });
      }
      const rows: { id: string }[] = [];
      if (providerRefund && card) {
        rows.push(
          await tx.refund.create({
            data: {
              paymentId: card.id,
              providerRefundId: providerRefund.id,
              amountCents: cardCents,
              reason,
              status: providerRefund.status,
            },
          }),
        );
        await tx.payment.update({
          where: { id: card.id },
          data: { status: cardCents >= left(card) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
        });
      }
      if (giftCents > 0 && gift) {
        const owner = await tx.giftBalanceEntry.findFirst({
          where: { orderId: order.id, kind: 'SPEND' },
          select: { userId: true },
        });
        if (owner) {
          await refundToGiftBalance(tx, owner.userId, order.id, giftCents, reason);
        }
        rows.push(
          await tx.refund.create({
            data: {
              paymentId: gift.id,
              providerRefundId: `gift_refund_${randomUUID()}`,
              amountCents: giftCents,
              reason,
              status: 'succeeded',
            },
          }),
        );
        await tx.payment.update({
          where: { id: gift.id },
          data: { status: giftCents >= left(gift) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
        });
      }
      await allocateRefund(
        tx,
        order,
        { id: rows[0]!.id, amountCents, cancel: Boolean(options.cancel) },
        options.restock,
      );
      if (options.restock?.length) await this.inventory.restock(tx, options.restock);
      if (options.returnId) {
        await tx.returnRequest.update({
          where: { id: options.returnId },
          data: { status: 'REFUNDED', refundCents: amountCents, resolvedAt: new Date() },
        });
      }
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'order',
          aggregateId: order.id,
          type: options.cancel ? 'order.cancelled' : 'order.refunded',
          payload: { number: order.number, amountCents, reason } as Prisma.InputJsonObject,
        },
      });
    });
  }

  /**
   * Refunding a gift card order (p10-10) voids its cards, so only in full, and only while none
   * has been redeemed.
   */
  private async assertGiftCardsRefundable(order: RefundableOrder, amountCents: number) {
    if (amountCents < this.remaining(order)) {
      throw new ConflictException('Gift card orders are refunded in full only.');
    }
    const redeemed = await this.prisma.giftCard.count({
      where: { orderId: order.id, status: 'REDEEMED' },
    });
    if (redeemed) throw new ConflictException('A gift card in this order was already redeemed.');
  }

  /** orderItemId + quantity → variant + quantity, checked against what was bought. */
  restockLines(
    order: RefundableOrder,
    lines: { orderItemId: string; quantity: number }[],
  ): { variantId: string; quantity: number }[] {
    return lines.flatMap((line) => {
      const item = order.items.find((i) => i.id === line.orderItemId);
      if (!item) throw new BadRequestException('That item is not part of this order.');
      if (line.quantity > item.quantity)
        throw new BadRequestException('More units than were bought.');
      return item.variantId ? [{ variantId: item.variantId, quantity: line.quantity }] : [];
    });
  }
}
