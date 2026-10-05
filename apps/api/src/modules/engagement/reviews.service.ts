import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminReviewQuery,
  type AdminReviewView,
  pagedResult,
  type PagedResult,
  type RatingSummary,
  type ReviewCreate,
  type ReviewView,
  totalPages,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../identity/auth-user';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { REVIEWS_CHANGED } from '../insights/events';
import { roundRating } from '../../common/rating';

const reviewInclude = {
  user: { select: { firstName: true, lastName: true, email: true } },
  product: { select: { id: true, slug: true, title: true } },
} satisfies Prisma.ReviewInclude;
type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

/** "Ada L." — first name and initial only; never the email address. */
function authorName(user: ReviewRow['user']): string {
  if (user.firstName) return `${user.firstName}${user.lastName ? ` ${user.lastName[0]}.` : ''}`;
  return 'NIXZORA customer';
}

function toView(row: ReviewRow): ReviewView {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    author: authorName(row.user),
    verifiedPurchase: row.verifiedPurchase,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Customer reviews. One per customer per product; editing sends it back to moderation.
 * "Verified purchase" means a paid order of that product by the author.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  async forProduct(
    slug: string,
    page: number,
  ): Promise<{ summary: RatingSummary; reviews: ReviewView[]; page: number; totalPages: number }> {
    const productId = await this.productId(slug);
    const where = { productId, status: 'APPROVED' as const };
    const pageSize = 10;
    const [byStar, rows] = await Promise.all([
      this.prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: [{ verifiedPurchase: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const distribution: RatingSummary['distribution'] = [0, 0, 0, 0, 0];
    for (const row of byStar) distribution[row.rating - 1] = row._count._all;
    const count = distribution.reduce((a, b) => a + b, 0);
    const sum = distribution.reduce((acc, n, i) => acc + n * (i + 1), 0);
    return {
      summary: { average: count ? roundRating(sum / count) : null, count, distribution },
      reviews: rows.map(toView),
      page,
      totalPages: totalPages(count, pageSize),
    };
  }

  /** The signed-in customer's own review of a product (any status), to prefill the form. */
  async mine(slug: string, user: AuthUser): Promise<(ReviewView & { status: string }) | null> {
    const productId = await this.productId(slug);
    const row = await this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId: user.id } },
      include: reviewInclude,
    });
    return row ? { ...toView(row), status: row.status } : null;
  }

  async submit(slug: string, input: ReviewCreate, user: AuthUser): Promise<{ status: string }> {
    const productId = await this.productId(slug);
    const bought = await this.prisma.orderItem.count({
      where: {
        variant: { productId },
        order: {
          userId: user.id,
          status: { in: ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED'] },
        },
      },
    });
    const data = {
      rating: input.rating,
      title: input.title,
      body: input.body,
      verifiedPurchase: bought > 0,
    };
    const previous = await this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId: user.id } },
      select: { status: true },
    });
    const review = await this.prisma.review.upsert({
      where: { productId_userId: { productId, userId: user.id } },
      create: { productId, userId: user.id, ...data },
      update: { ...data, status: 'PENDING', moderatedAt: null, moderatedById: null },
    });
    // An edited review goes back to moderation, so it leaves the product's insights for now.
    if (previous?.status === 'APPROVED') await this.reviewsChanged(productId);
    return { status: review.status };
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
        ...toView(row),
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
