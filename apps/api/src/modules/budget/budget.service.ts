import { Injectable } from '@nestjs/common';
import { type BudgetUpdate, type BudgetView, easternMonth } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Monthly budget (p10-35): a private cap the customer sets. What counts is what they paid this
 * Eastern month (orders placed since the 1st, less refunds); cancelled and unpaid orders don't.
 * Only the customer sees it, and it never stops a purchase.
 */
@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, now = new Date()): Promise<BudgetView> {
    const { month, start } = easternMonth(now);
    const [user, spent] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { monthlyBudgetCents: true },
      }),
      this.prisma.order.aggregate({
        where: {
          userId,
          placedAt: { gte: start },
          status: { notIn: ['PENDING_PAYMENT', 'CANCELLED', 'REFUNDED'] },
        },
        _sum: { totalCents: true, refundedCents: true },
      }),
    ]);
    const spentCents = Math.max(0, (spent._sum.totalCents ?? 0) - (spent._sum.refundedCents ?? 0));
    const monthlyCents = user.monthlyBudgetCents;
    return {
      monthlyCents,
      spentCents,
      leftCents: monthlyCents === null ? 0 : monthlyCents - spentCents,
      month,
    };
  }

  async set(userId: string, input: BudgetUpdate): Promise<BudgetView> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { monthlyBudgetCents: input.monthlyCents },
    });
    return this.get(userId);
  }
}
