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

const REFUNDABLE = ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED'] as const;

export type RefundableOrder = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  refundedCents: number;
  items: { id: string; variantId: string | null; quantity: number }[];
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
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: order.id, status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new ConflictException('No captured payment to refund.');

    let refund: { id: string; status: string };
    try {
      refund = await this.gateway.refund(payment.providerPaymentId, amountCents, reason);
    } catch (error) {
      this.logger.error(`Refund failed for ${order.number}: ${(error as Error).message}`);
      throw new BadGatewayException(
        'The refund could not be issued. Nothing was changed; try again.',
      );
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
          `Concurrent refund on ${order.number}; recording provider refund ${refund.id}.`,
        );
        await tx.order.update({
          where: { id: order.id },
          data: { refundedCents: { increment: amountCents } },
        });
      }
      await tx.refund.create({
        data: {
          paymentId: payment.id,
          providerRefundId: refund.id,
          amountCents,
          reason,
          status: refund.status,
        },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      });
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
