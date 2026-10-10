import { ratingSummary } from '../../common/rating';
import { type SellerProductRow, type SellerView } from '@nixzora/validation';
import { type Seller } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';
import { type ProductWithRelations, toCard } from '../catalog/catalog-mappers';

export type ListingCounts = SellerView['listings'];

export const NO_LISTINGS: ListingCounts = { draft: 0, pendingReview: 0, active: 0, archived: 0 };

export function toSellerView(
  seller: Seller,
  publicUrl: (key: string) => string,
  listings: ListingCounts = NO_LISTINGS,
): SellerView {
  return {
    id: seller.id,
    handle: seller.handle,
    displayName: seller.displayName,
    legalName: seller.legalName,
    contactEmail: seller.contactEmail,
    country: seller.country,
    description: seller.description,
    status: seller.status,
    statusReason: seller.statusReason,
    payouts: {
      provider: seller.payoutProvider as 'FAKE' | 'STRIPE' | null,
      accountConnected: Boolean(seller.payoutAccountId),
      detailsSubmitted: seller.detailsSubmitted,
      payoutsEnabled: seller.payoutsEnabled,
      requirementsDue: seller.requirementsDue,
    },
    commissionBps: seller.commissionBps,
    payoutHoldDays: seller.payoutHoldDays,
    listings,
    rating: ratingSummary(seller),
    approvedAt: seller.approvedAt?.toISOString() ?? null,
    createdAt: seller.createdAt.toISOString(),
    businessType: seller.businessType,
    category: seller.category,
    website: seller.website,
    logoUrl: seller.logoKey ? publicUrl(seller.logoKey) : null,
    bannerUrl: seller.bannerKey ? publicUrl(seller.bannerKey) : null,
    supportEmail: seller.supportEmail,
    supportPhone: seller.supportPhone,
    address:
      seller.addressLine1 && seller.addressCity && seller.addressRegion && seller.addressPostalCode
        ? {
            line1: seller.addressLine1,
            line2: seller.addressLine2,
            city: seller.addressCity,
            region: seller.addressRegion,
            postalCode: seller.addressPostalCode,
            country: seller.country,
          }
        : null,
    shipping: {
      handlingDays: seller.handlingDays,
      carriers: seller.carriers,
      shipRegions: seller.shipRegions,
    },
  };
}

/** Listing counts by status for each seller id, in one query. */
export async function listingCounts(
  prisma: PrismaService,
  sellerIds: string[],
): Promise<Map<string, ListingCounts>> {
  const rows = await prisma.product.groupBy({
    by: ['sellerId', 'status'],
    where: { sellerId: { in: sellerIds } },
    _count: { _all: true },
  });
  const result = new Map<string, ListingCounts>();
  for (const row of rows) {
    if (!row.sellerId) continue;
    const counts = result.get(row.sellerId) ?? { ...NO_LISTINGS };
    const key = (
      {
        DRAFT: 'draft',
        PENDING_REVIEW: 'pendingReview',
        ACTIVE: 'active',
        ARCHIVED: 'archived',
      } as const
    )[row.status];
    counts[key] = row._count._all;
    result.set(row.sellerId, counts);
  }
  return result;
}

export function toListingRow(
  product: ProductWithRelations,
  publicUrl: (key: string) => string,
): SellerProductRow {
  return {
    ...toCard(product, publicUrl),
    status: product.status,
    reviewNote: product.reviewNote,
    updatedAt: product.updatedAt.toISOString(),
    subscribable: product.subscribable,
  };
}
