import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminSellerListQuery,
  type AdminSellerStatusChange,
  type AdminSellerTerms,
  type AdminSellerView,
  type ListingReviewDecision,
  type ListingReviewQuery,
  type ListingReviewRow,
  pagedResult,
  type PagedResult,
  type ProductDetail,
} from '@nixzora/validation';
import { type Prisma, type Seller, type SellerOwner } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { productInclude } from '../catalog/catalog-mappers';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { StorageService } from '../media/storage.service';
import { listingCounts, NO_LISTINGS, toListingRow, toSellerView } from './seller-mappers';
import { SellerPii } from './seller-pii';
import { SellersService } from './sellers.service';

const SUSPENDED_NOTE = 'Unpublished while the store is suspended.';

/**
 * Ops Center seller management (p7-10): approve, suspend or reject stores, set their terms,
 * and review listings before they go live.
 */
@Injectable()
export class SellersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sellers: SellersService,
    private readonly query: CatalogQueryService,
    private readonly storage: StorageService,
    private readonly pii: SellerPii,
  ) {}

  async list(query: AdminSellerListQuery): Promise<PagedResult<AdminSellerView>> {
    const where: Prisma.SellerWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: ['displayName', 'legalName', 'handle', 'contactEmail'].map((field) => ({
              [field]: { contains: query.q, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.seller.count({ where }),
      this.prisma.seller.findMany({
        where,
        include: this.ownerInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    const counts = await listingCounts(
      this.prisma,
      rows.map((row) => row.id),
    );
    return pagedResult(
      rows.map((row) => this.adminView(row, counts.get(row.id))),
      total,
      query,
    );
  }

  async get(id: string): Promise<AdminSellerView> {
    const seller = await this.prisma.seller.findUnique({
      where: { id },
      include: this.ownerInclude,
    });
    if (!seller) throw new NotFoundException('Seller not found.');
    const counts = await listingCounts(this.prisma, [id]);
    return this.adminView(seller, counts.get(id));
  }

  /** Re-reads payout verification from the provider. */
  async refreshPayouts(id: string, actor: ActorContext): Promise<AdminSellerView> {
    const seller = await this.require(id);
    await this.sellers.syncPayoutStatus(seller);
    await this.audit.recordFor(actor, 'seller.payouts.refreshed', 'seller', id);
    return this.get(id);
  }

  async changeStatus(
    id: string,
    input: AdminSellerStatusChange,
    actor: ActorContext,
  ): Promise<AdminSellerView> {
    const seller = await this.require(id);
    if (seller.status === input.status) {
      throw new ConflictException(`The store is already ${input.status.toLowerCase()}.`);
    }
    if (input.status === 'REJECTED' && seller.status !== 'PENDING') {
      throw new ConflictException('Only pending applications can be rejected. Suspend instead.');
    }
    if (input.status === 'ACTIVE' && !seller.detailsSubmitted) {
      throw new ConflictException(
        'The seller has not finished payout verification yet. Approve once it is complete.',
      );
    }

    const action =
      input.status === 'ACTIVE'
        ? seller.status === 'SUSPENDED'
          ? 'seller.reinstated'
          : 'seller.approved'
        : input.status === 'SUSPENDED'
          ? 'seller.suspended'
          : 'seller.rejected';

    const unpublished = await this.prisma.$transaction(async (tx) => {
      await tx.seller.update({
        where: { id },
        data: {
          status: input.status,
          statusReason: input.status === 'ACTIVE' ? null : (input.reason ?? null),
          ...(input.status === 'ACTIVE' && !seller.approvedAt ? { approvedAt: new Date() } : {}),
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'seller',
          aggregateId: id,
          type: `seller.status.${input.status.toLowerCase()}`,
          payload: { sellerId: id, status: input.status, from: seller.status },
        },
      });
      if (input.status === 'ACTIVE') return [];
      // A suspended or rejected store sells nothing: live and pending listings go back to draft.
      const live = await tx.product.findMany({
        where: { sellerId: id, status: { in: ['ACTIVE', 'PENDING_REVIEW'] } },
        select: { id: true },
      });
      for (const product of live) {
        await tx.product.update({
          where: { id: product.id },
          data: { status: 'DRAFT', reviewNote: SUSPENDED_NOTE },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'product',
            aggregateId: product.id,
            type: 'catalog.product.updated',
            payload: { productId: product.id, changes: ['status'], status: 'DRAFT' },
          },
        });
      }
      return live.map((product) => product.id);
    });

    await this.audit.recordFor(actor, action, 'seller', id, {
      from: seller.status,
      to: input.status,
      reason: input.reason,
      ...(unpublished.length ? { listingsUnpublished: unpublished.length } : {}),
    });
    return this.get(id);
  }

  async updateTerms(
    id: string,
    input: AdminSellerTerms,
    actor: ActorContext,
  ): Promise<AdminSellerView> {
    const seller = await this.require(id);
    await this.prisma.seller.update({ where: { id }, data: input });
    await this.audit.recordFor(actor, 'seller.terms.updated', 'seller', id, {
      ...(input.commissionBps !== undefined
        ? { commissionFrom: seller.commissionBps, commissionTo: input.commissionBps }
        : {}),
      ...(input.payoutHoldDays !== undefined
        ? { holdFrom: seller.payoutHoldDays, holdTo: input.payoutHoldDays }
        : {}),
    });
    return this.get(id);
  }

  /** Listings waiting for review, oldest first so nothing waits forever. */
  async reviewQueue(query: ListingReviewQuery): Promise<PagedResult<ListingReviewRow>> {
    const where = { status: 'PENDING_REVIEW' as const, sellerId: { not: null } };
    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { ...productInclude, seller: true },
        orderBy: { updatedAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return pagedResult(
      rows.map((row) => ({
        ...toListingRow(row, (key) => this.storage.publicUrl(key)),
        seller: {
          id: row.seller!.id,
          handle: row.seller!.handle,
          displayName: row.seller!.displayName,
        },
      })),
      total,
      query,
    );
  }

  async decide(
    productId: string,
    input: ListingReviewDecision,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { seller: true },
    });
    if (!product?.seller) throw new NotFoundException('Listing not found.');
    if (product.status !== 'PENDING_REVIEW') {
      throw new ConflictException('This listing is not waiting for review.');
    }
    if (input.decision === 'APPROVE' && product.seller.status !== 'ACTIVE') {
      throw new ConflictException('The store is not active, so its listings cannot go live.');
    }
    const status = input.decision === 'APPROVE' ? 'ACTIVE' : 'DRAFT';
    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: productId },
        data: { status, reviewNote: input.decision === 'APPROVE' ? null : input.note! },
      }),
      this.prisma.outboxEvent.create({
        data: {
          aggregateType: 'product',
          aggregateId: productId,
          type: 'catalog.product.updated',
          payload: { productId, changes: ['status'], status },
        },
      }),
    ]);
    await this.audit.record({
      action:
        input.decision === 'APPROVE' ? 'catalog.listing.approved' : 'catalog.listing.rejected',
      actorType: 'ADMIN',
      actorId: actor.user.id,
      entityType: 'product',
      entityId: productId,
      meta: actor.meta,
      metadata: { sellerId: product.seller.id, note: input.note },
    });
    return this.query.productById(productId);
  }

  // ───────────── Helpers ─────────────

  private readonly ownerInclude = {
    members: {
      where: { role: 'OWNER' as const },
      take: 1,
      include: { user: { select: { id: true, email: true } } },
    },
    owner: true,
  } satisfies Prisma.SellerInclude;

  private adminView(
    seller: Seller & {
      members: { user: { id: string; email: string } }[];
      owner: SellerOwner | null;
    },
    counts = NO_LISTINGS,
  ): AdminSellerView {
    const owner = seller.members[0]?.user ?? null;
    const person = seller.owner;
    return {
      ...toSellerView(seller, (key) => this.storage.publicUrl(key), counts),
      owner,
      verification: person
        ? {
            firstName: person.firstName,
            lastName: person.lastName,
            dateOfBirth: this.pii.open(person.dateOfBirthEnc),
            phone: person.phone,
            residenceCountry: person.residenceCountry,
          }
        : null,
      whatYouSell: seller.whatYouSell,
      agreementsAcceptedAt: seller.agreementsAcceptedAt?.toISOString() ?? null,
    };
  }

  private async require(id: string): Promise<Seller> {
    const seller = await this.prisma.seller.findUnique({ where: { id } });
    if (!seller) throw new NotFoundException('Seller not found.');
    return seller;
  }
}
