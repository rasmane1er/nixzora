import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AdminReviewQuery,
  type AdminReviewView,
  pagedResult,
  type PagedResult,
  type RatingSummary,
  type ReviewCreate,
  type ReviewListQuery,
  type ReviewPage,
  type ReviewSort,
  type ReviewView,
  totalPages,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../identity/auth-user';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { REVIEWS_CHANGED } from '../insights/events';
import { MediaIntakeService } from '../media/media-intake.service';
import { StorageService } from '../media/storage.service';
import { roundRating } from '../../common/rating';

const reviewInclude = {
  user: { select: { firstName: true, lastName: true, email: true } },
  product: { select: { id: true, slug: true, title: true } },
  photos: { orderBy: { position: 'asc' }, select: { storageKey: true } },
} satisfies Prisma.ReviewInclude;
type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

/** "Ada L." — first name and initial only; never the email address. */
export function authorName(user: { firstName: string | null; lastName: string | null }): string {
  if (user.firstName) return `${user.firstName}${user.lastName ? ` ${user.lastName[0]}.` : ''}`;
  return 'NIXZORA customer';
}

function toView(row: ReviewRow, url: (key: string) => string): ReviewView {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    author: authorName(row.user),
    verifiedPurchase: row.verifiedPurchase,
    createdAt: row.createdAt.toISOString(),
    photos: row.photos.map((photo) => ({ url: url(photo.storageKey) })),
    helpfulCount: row.helpfulCount,
    fit: row.fit ?? null,
  };
}

/**
 * Customer reviews. One per customer per product; editing sends it back to moderation.
 * Only customers who received the product can write one (its order, or for a marketplace item
 * the seller's parcel, was delivered), so every new review is from a verified buyer.
 */
const REVIEW_PAGE_SIZE = 10;

/** Ties always fall back to the newest review first, so pages never shuffle. */
const REVIEW_ORDER: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  relevant: [
    { verifiedPurchase: 'desc' },
    { helpfulCount: 'desc' },
    { createdAt: 'desc' },
    { id: 'desc' },
  ],
  helpful: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  highest: [{ rating: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  lowest: [{ rating: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
};

/** Order states that mean the customer has the items (a later partial refund keeps them). */
const DELIVERED_ORDER: string[] = ['DELIVERED', 'PARTIALLY_REFUNDED'];

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly intake: MediaIntakeService,
  ) {}

  private readonly url = (key: string) => this.storage.publicUrl(key);

  private async productId(slug: string): Promise<string> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('We could not find that product.');
    return product.id;
  }

  async summaryFor(
    productIds: string[],
  ): Promise<Map<string, { average: number | null; count: number }>> {
    if (!productIds.length) return new Map();
    const rows = await this.prisma.review.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return new Map(
      rows.map((row) => [
        row.productId,
        {
          average: row._avg.rating === null ? null : roundRating(row._avg.rating),
          count: row._count._all,
        },
      ]),
    );
  }

  async forProduct(slug: string, query: ReviewListQuery): Promise<ReviewPage> {
    const productId = await this.productId(slug);
    const where = { productId, status: 'APPROVED' as const };
    const shown = {
      ...where,
      ...(query.rating ? { rating: query.rating } : {}),
      ...(query.withPhotos ? { photos: { some: {} } } : {}),
    };
    const [byStar, rows] = await Promise.all([
      this.prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
      this.prisma.review.findMany({
        where: shown,
        include: reviewInclude,
        orderBy: REVIEW_ORDER[query.sort],
        skip: (query.page - 1) * REVIEW_PAGE_SIZE,
        take: REVIEW_PAGE_SIZE,
      }),
    ]);
    const distribution: RatingSummary['distribution'] = [0, 0, 0, 0, 0];
    for (const row of byStar) distribution[row.rating - 1] = row._count._all;
    const count = distribution.reduce((a, b) => a + b, 0);
    const sum = distribution.reduce((acc, n, i) => acc + n * (i + 1), 0);
    const total =
      query.rating || query.withPhotos ? await this.prisma.review.count({ where: shown }) : count;
    return {
      summary: { average: count ? roundRating(sum / count) : null, count, distribution },
      reviews: rows.map((row) => toView(row, this.url)),
      page: query.page,
      totalPages: totalPages(total, REVIEW_PAGE_SIZE),
      total,
    };
  }

  /**
   * The signed-in customer's own review of a product (any status), to prefill the form, and
   * whether they may write one: only after the product was delivered to them.
   */
  async mine(
    slug: string,
    user: AuthUser,
  ): Promise<{
    review: (ReviewView & { status: string }) | null;
    canReview: boolean;
    /** Reviews of this product the customer marked helpful (p10-05). */
    helpfulVotes: string[];
  }> {
    const productId = await this.productId(slug);
    const [row, votes] = await Promise.all([
      this.prisma.review.findUnique({
        where: { productId_userId: { productId, userId: user.id } },
        include: reviewInclude,
      }),
      this.prisma.reviewVote.findMany({
        where: { userId: user.id, review: { productId } },
        select: { reviewId: true },
      }),
    ]);
    return {
      review: row ? { ...toView(row, this.url), status: row.status } : null,
      canReview: row !== null || (await this.received(productId, user.id)),
      helpfulVotes: votes.map((vote) => vote.reviewId),
    };
  }

  /**
   * Whether this customer has received the product: an order of it that was delivered, or, for
   * an item a marketplace store sold, that store's parcel was delivered.
   */
  async received(productId: string, userId: string): Promise<boolean> {
    const items = await this.prisma.orderItem.findMany({
      where: { variant: { productId }, order: { userId } },
      select: {
        sellerId: true,
        order: {
          select: {
            status: true,
            deliveredAt: true,
            sellerOrders: { select: { sellerId: true, deliveredAt: true } },
          },
        },
      },
    });
    return items.some(
      ({ sellerId, order }) =>
        order.deliveredAt !== null ||
        DELIVERED_ORDER.includes(order.status) ||
        (sellerId !== null &&
          order.sellerOrders.some((part) => part.sellerId === sellerId && part.deliveredAt)),
    );
  }

  async submit(slug: string, input: ReviewCreate, user: AuthUser): Promise<{ status: string }> {
    const productId = await this.productId(slug);
    const previous = await this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId: user.id } },
      select: { status: true, verifiedPurchase: true },
    });
    // Editing a review you already wrote stays possible; a new one needs the product delivered.
    const received = await this.received(productId, user.id);
    if (!previous && !received) {
      throw new ForbiddenException(
        'You can review this product once it has been delivered to you.',
      );
    }
    const data = {
      rating: input.rating,
      title: input.title,
      body: input.body,
      verifiedPurchase: received || (previous?.verifiedPurchase ?? false),
      // Size & fit (p10-26): kept as given; left as it was when an edit doesn't say.
      ...(input.fit !== undefined ? { fit: input.fit } : {}),
    };
    // Photos are checked and re-encoded like product photos before they are kept.
    const photoKeys = [...new Set(input.photoKeys ?? [])];
    for (const key of photoKeys) {
      if (!(await this.intake.ensureReady(key))) {
        throw new BadRequestException('One of the photos did not finish uploading. Try again.');
      }
    }
    const review = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.review.upsert({
        where: { productId_userId: { productId, userId: user.id } },
        create: { productId, userId: user.id, ...data },
        update: { ...data, status: 'PENDING', moderatedAt: null, moderatedById: null },
      });
      if (input.photoKeys !== undefined) {
        await tx.reviewPhoto.deleteMany({ where: { reviewId: saved.id } });
        await tx.reviewPhoto.createMany({
          data: photoKeys.map((storageKey, position) => ({
            reviewId: saved.id,
            storageKey,
            position,
          })),
        });
      }
      return saved;
    });
    // An edited review goes back to moderation, so it leaves the product's insights for now.
    if (previous?.status === 'APPROVED') await this.reviewsChanged(productId);
    return { status: review.status };
  }

  /** A fresh upload link for a review photo (images up to 8 MB). */
  photoUpload(contentType: Parameters<StorageService['createUpload']>[0], sizeBytes: number) {
    if (sizeBytes > 8 * 1024 * 1024) {
      throw new BadRequestException('Photos can be up to 8 MB.');
    }
    return this.storage.createUpload(contentType, sizeBytes);
  }

  /**
   * "Was this helpful?" (p10-05): one vote per customer per review, never on your own. Voting
   * twice changes nothing; `helpful: false` takes the vote back.
   */
  async vote(
    reviewId: string,
    helpful: boolean,
    user: AuthUser,
  ): Promise<{ helpfulCount: number; voted: boolean }> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, status: 'APPROVED' },
      select: { userId: true },
    });
    if (!review) throw new NotFoundException('We could not find that review.');
    if (review.userId === user.id) {
      throw new ForbiddenException('You cannot vote for your own review.');
    }
    return this.prisma.$transaction(async (tx) => {
      const key = { reviewId_userId: { reviewId, userId: user.id } };
      const existing = await tx.reviewVote.findUnique({ where: key });
      if (helpful && !existing) {
        await tx.reviewVote.create({ data: { reviewId, userId: user.id } });
        await tx.review.update({
          where: { id: reviewId },
          data: { helpfulCount: { increment: 1 } },
        });
      } else if (!helpful && existing) {
        await tx.reviewVote.delete({ where: key });
        await tx.review.update({
          where: { id: reviewId },
          data: { helpfulCount: { decrement: 1 } },
        });
      }
      const after = await tx.review.findUniqueOrThrow({
        where: { id: reviewId },
        select: { helpfulCount: true },
      });
      return { helpfulCount: after.helpfulCount, voted: helpful };
    });
  }

  // ───── Moderation ─────

  async queue(query: AdminReviewQuery): Promise<PagedResult<AdminReviewView>> {
    const where = { status: query.status };
    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: query.status === 'PENDING' ? 'asc' : 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return pagedResult(
      rows.map((row) => ({
        ...toView(row, this.url),
        status: row.status,
        product: row.product,
        authorEmail: row.user.email,
      })),
      total,
      query,
    );
  }

  async moderate(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    actor: ActorContext,
  ): Promise<{ status: string }> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found.');
    await this.prisma.$transaction([
      this.prisma.review.update({
        where: { id },
        data: { status, moderatedAt: new Date(), moderatedById: actor.user.id },
      }),
      this.reviewsChangedEvent(review.productId),
    ]);
    await this.audit.record({
      action: `reviews.${status === 'APPROVED' ? 'approved' : 'rejected'}`,
      actorId: actor.user.id,
      entityType: 'review',
      entityId: id,
      meta: actor.meta,
      metadata: { productId: review.productId, rating: review.rating },
    });
    return { status };
  }

  /** Tells review insights (p6-04) to rebuild this product's summary. */
  private reviewsChangedEvent(productId: string) {
    return this.prisma.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: productId,
        type: REVIEWS_CHANGED,
        payload: { productId },
      },
    });
  }

  private async reviewsChanged(productId: string): Promise<void> {
    await this.reviewsChangedEvent(productId);
  }
}
