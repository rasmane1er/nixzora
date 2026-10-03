import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SELLER_RATING_WINDOW_DAYS, type SellerRatingCreate } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { type OrderRow, ratableUntil } from './order-links';

/**
 * Seller ratings (p7-07): the customer rates each delivered seller shipment 1–5, and can change
 * it until the window closes. The seller's running totals change in the same transaction, with
 * the shipment row locked so two submissions can't both count as new.
 */
@Injectable()
export class SellerRatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async rate(order: OrderRow, input: SellerRatingCreate): Promise<void> {
    const part = order.sellerOrders.find((p) => p.seller.handle === input.seller);
    if (!part) throw new NotFoundException('That seller has no items in this order.');
    if (!ratableUntil(part)) {
      throw new ConflictException(
        part.status === 'DELIVERED'
          ? `Ratings close ${SELLER_RATING_WINDOW_DAYS} days after delivery.`
          : 'You can rate the seller once this parcel has been delivered.',
      );
    }
    const comment = input.comment ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM seller_orders WHERE id = ${part.id}::uuid FOR UPDATE`;
      const existing = await tx.sellerRating.findUnique({ where: { sellerOrderId: part.id } });
      if (existing) {
        await tx.sellerRating.update({
          where: { id: existing.id },
          data: { rating: input.rating, comment },
        });
        await tx.seller.update({
          where: { id: part.sellerId },
          data: { ratingTotal: { increment: input.rating - existing.rating } },
        });
      } else {
        await tx.sellerRating.create({
          data: {
            sellerOrderId: part.id,
            sellerId: part.sellerId,
            rating: input.rating,
            comment,
          },
        });
        await tx.seller.update({
          where: { id: part.sellerId },
          data: { ratingCount: { increment: 1 }, ratingTotal: { increment: input.rating } },
        });
      }
    });
  }
}
