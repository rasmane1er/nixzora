import { Injectable, NotFoundException } from '@nestjs/common';
import { type SellerFeedback } from '@nixzora/validation';
import { ratingSummary } from '../../common/rating';
import { PrismaService } from '../../prisma/prisma.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { RETURN_REASONS } from '../orders/returns.service';
import { SellersService } from './sellers.service';

type ReturnLine = { orderItemId: string; quantity: number };

/**
 * What customers say about a store (p7-07): its ratings with their private comments, and the
 * return requests that include its items. Staff decide returns; the seller sees them so a
 * returned parcel and the refund deducted from earnings are never a surprise.
 */
@Injectable()
export class SellerFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellers: SellersService,
  ) {}

  async forSeller(actor: ActorContext): Promise<SellerFeedback> {
    const { seller } = await this.sellers.require(actor.user.id);
    return this.build(seller.id);
  }

  async build(sellerId: string): Promise<SellerFeedback> {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Seller not found.');
    const [groups, ratings, returns] = await Promise.all([
      this.prisma.sellerRating.groupBy({
        by: ['rating'],
        where: { sellerId },
        _count: { _all: true },
      }),
      this.prisma.sellerRating.findMany({
        where: { sellerId },
        include: { sellerOrder: { select: { order: { select: { number: true } } } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.returnRequest.findMany({
        where: { order: { items: { some: { sellerId } } } },
        include: { order: { select: { number: true, items: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const breakdown = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const group of groups) {
      breakdown[String(group.rating) as keyof typeof breakdown] = group._count._all;
    }

    return {
      rating: { ...ratingSummary(seller), breakdown },
      ratings: ratings.map((row) => ({
        id: row.id,
        orderNumber: row.sellerOrder.order.number,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      returns: returns.flatMap((row) => {
        const own = new Map(
          row.order.items.filter((item) => item.sellerId === sellerId).map((i) => [i.id, i]),
        );
        // Only this store's lines; a request for another seller's items is not shown at all.
        const items = (row.items as ReturnLine[])
          .filter((line) => own.has(line.orderItemId))
          .map((line) => {
            const item = own.get(line.orderItemId)!;
            return {
              orderItemId: line.orderItemId,
              quantity: line.quantity,
              productTitle: `${item.productTitle} · ${item.variantTitle}`,
              sku: item.sku,
            };
          });
        if (!items.length) return [];
        return [
          {
            id: row.id,
            orderNumber: row.order.number,
            status: row.status,
            reason: RETURN_REASONS[row.reason] ?? row.reason,
            customerNote: row.customerNote,
            staffNote: row.staffNote,
            items,
            createdAt: row.createdAt.toISOString(),
            resolvedAt: row.resolvedAt?.toISOString() ?? null,
          },
        ];
      }),
    };
  }
}
