import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  RETURN_WINDOW_DAYS,
  type ReturnCreate,
  type ReturnDecision,
  type ReturnView,
} from '@nixzora/validation';
import { type Prisma, type ReturnStatus } from '../../generated/prisma/client';
import { type RequestMeta } from '../../common/request-meta';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../identity/auth-user';
import { orderInclude, type OrderRow } from './order-links';
import { RefundsService } from './refunds.service';

type ReturnLine = { orderItemId: string; quantity: number };
type ReturnWithOrder = Prisma.ReturnRequestGetPayload<{
  include: { order: { include: typeof orderInclude } };
}>;

export const RETURN_REASONS: Record<string, string> = {
  DAMAGED: 'Arrived damaged',
  NOT_AS_DESCRIBED: 'Not as described',
  WRONG_ITEM: 'Wrong item sent',
  NO_LONGER_NEEDED: 'No longer needed',
  OTHER: 'Other',
};

export function returnWindowEnd(order: { deliveredAt: Date | null }): Date | null {
  return order.deliveredAt
    ? new Date(order.deliveredAt.getTime() + RETURN_WINDOW_DAYS * 86_400_000)
    : null;
}

/**
 * Returns: the customer asks (within 30 days of delivery), staff approve or reject, and when
 * the parcel arrives staff mark it received, which refunds what was paid for those units —
 * their share of any coupon discount comes off, their share of the tax goes back.
 */
@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refunds: RefundsService,
    private readonly audit: AuditService,
  ) {}

  async request(order: OrderRow, input: ReturnCreate): Promise<ReturnView> {
    if (order.kind === 'GIFT_CARD') {
      throw new ConflictException(
        'Gift cards can’t be returned. If it hasn’t been used, contact us for a refund.',
      );
    }
    const until = returnWindowEnd(order);
    if (!until || !['DELIVERED', 'PARTIALLY_REFUNDED'].includes(order.status)) {
      throw new ConflictException('Returns open once your order has been delivered.');
    }
    if (until < new Date())
      throw new ConflictException(`Returns close ${RETURN_WINDOW_DAYS} days after delivery.`);

    const open = await this.prisma.returnRequest.findMany({
      where: { orderId: order.id, status: { not: 'REJECTED' } },
    });
    const already = new Map<string, number>();
    for (const r of open) {
      for (const line of r.items as ReturnLine[]) {
        already.set(line.orderItemId, (already.get(line.orderItemId) ?? 0) + line.quantity);
      }
    }
    const merged = new Map<string, number>();
    for (const line of input.items)
      merged.set(line.orderItemId, (merged.get(line.orderItemId) ?? 0) + line.quantity);
    for (const [orderItemId, quantity] of merged) {
      const item = order.items.find((i) => i.id === orderItemId);
      if (!item) throw new BadRequestException('That item is not part of this order.');
      if (quantity + (already.get(orderItemId) ?? 0) > item.quantity) {
        throw new BadRequestException(
          `You can return at most ${item.quantity - (already.get(orderItemId) ?? 0)} of ${item.productTitle}.`,
        );
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.returnRequest.create({
        data: {
          orderId: order.id,
          reason: input.reason,
          customerNote: input.note ?? null,
          items: [...merged].map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'return',
          aggregateId: row.id,
          type: 'return.requested',
          payload: { orderId: order.id },
        },
      });
      return row;
    });
    return this.view(await this.load(created.id));
  }

  async forOrder(orderId: string): Promise<ReturnView[]> {
    const rows = await this.prisma.returnRequest.findMany({
      where: { orderId },
      include: { order: { include: orderInclude } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.view(row));
  }

  /** Every return the customer asked for, newest first (Your Account → Returns). */
  async forUser(userId: string): Promise<ReturnView[]> {
    const rows = await this.prisma.returnRequest.findMany({
      where: { order: { userId } },
      include: { order: { include: orderInclude } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.view(row));
  }

  async list(status?: ReturnStatus): Promise<ReturnView[]> {
    const rows = await this.prisma.returnRequest.findMany({
      where: status ? { status } : {},
      include: { order: { include: orderInclude } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => this.view(row));
  }

  async decide(
    id: string,
    input: ReturnDecision,
    actor: { user: AuthUser; meta: RequestMeta },
  ): Promise<ReturnView> {
    const row = await this.load(id);
    const move = async (
      from: ReturnStatus[],
      data: Prisma.ReturnRequestUpdateManyMutationInput,
      event: string,
    ) => {
      const done = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.returnRequest.updateMany({
          where: { id, status: { in: from } },
          data,
        });
        if (updated.count) {
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'return',
              aggregateId: id,
              type: event,
              payload: { orderId: row.orderId },
            },
          });
        }
        return updated.count > 0;
      });
      if (!done) throw new ConflictException(`A ${row.status.toLowerCase()} return can't do that.`);
    };

    switch (input.action) {
      case 'approve':
        await move(
          ['REQUESTED'],
          { status: 'APPROVED', staffNote: input.note ?? null },
          'return.approved',
        );
        break;
      case 'reject':
        await move(
          ['REQUESTED', 'APPROVED'],
          { status: 'REJECTED', staffNote: input.note, resolvedAt: new Date() },
          'return.rejected',
        );
        break;
      case 'receive': {
        if (row.status !== 'APPROVED')
          throw new ConflictException('Approve the return before receiving it.');
        if (!actor.user.permissions.includes('orders.refund')) {
          throw new ForbiddenException(
            'Receiving a return refunds it. Ask someone who can issue refunds.',
          );
        }
        const lines = row.items as ReturnLine[];
        const amount = Math.min(
          this.refundFor(row.order, lines),
          this.refunds.remaining(row.order),
        );
        await this.refunds.refund(
          row.order,
          amount,
          `Return: ${RETURN_REASONS[row.reason] ?? row.reason}`,
          {
            returnId: id,
            restock: input.restock ? this.refunds.restockLines(row.order, lines) : [],
          },
        );
        break;
      }
    }

    await this.audit.record({
      action: `orders.return.${input.action === 'receive' ? 'refunded' : input.action === 'approve' ? 'approved' : 'rejected'}`,
      actorId: actor.user.id,
      entityType: 'return',
      entityId: id,
      meta: actor.meta,
      metadata: { order: row.order.number },
    });
    return this.view(await this.load(id));
  }

  /** What the customer paid for these units: price, minus their share of the discount, plus tax. */
  refundFor(order: OrderRow, lines: ReturnLine[]): number {
    const goods = lines.reduce((sum, line) => {
      const item = order.items.find((i) => i.id === line.orderItemId);
      return sum + (item ? item.unitPriceCents * line.quantity : 0);
    }, 0);
    if (order.subtotalCents === 0) return 0;
    const discount = Math.round((order.discountCents * goods) / order.subtotalCents);
    const taxable = order.subtotalCents - order.discountCents;
    const tax = taxable > 0 ? Math.round((order.taxCents * (goods - discount)) / taxable) : 0;
    return goods - discount + tax;
  }

  private async load(id: string): Promise<ReturnWithOrder> {
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { order: { include: orderInclude } },
    });
    if (!row) throw new NotFoundException('Return not found.');
    return row;
  }

  view(row: ReturnWithOrder): ReturnView {
    return {
      id: row.id,
      orderId: row.orderId,
      orderNumber: row.order.number,
      status: row.status,
      reason: RETURN_REASONS[row.reason] ?? row.reason,
      customerNote: row.customerNote,
      staffNote: row.staffNote,
      items: (row.items as ReturnLine[]).map((line) => {
        const item = row.order.items.find((i) => i.id === line.orderItemId);
        return {
          orderItemId: line.orderItemId,
          quantity: line.quantity,
          productTitle: item ? `${item.productTitle} · ${item.variantTitle}` : 'Removed item',
          sku: item?.sku ?? '',
        };
      }),
      refundCents: row.refundCents,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    };
  }
}
