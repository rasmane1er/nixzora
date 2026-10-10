import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AccountCoupon,
  type AccountOrder,
  type AccountOrderQuery,
  type AccountOverview,
  type AccountPreferences,
  type AccountProfile,
  type AccountReview,
  type Address,
  type BuyAgainItem,
  pagedResult,
  type PagedResult,
  type ProfileUpdate,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type ImageContentType } from '../media/image-type';
import { MediaIntakeService } from '../media/media-intake.service';
import { StorageService } from '../media/storage.service';
import { TRACKING_URLS, returnableUntil } from '../orders/order-links';

const OPEN: Prisma.EnumOrderStatusFilter['in'] = ['PAID', 'FULFILLING', 'SHIPPED'];
const PLACED_NOT: Prisma.OrderWhereInput = {
  // Abandoned checkouts (unpaid for an hour) are not orders yet.
  NOT: { status: 'PENDING_PAYMENT', createdAt: { lt: new Date(Date.now() - 3600_000) } },
};

const orderHistoryInclude = {
  items: {
    include: {
      variant: {
        select: {
          id: true,
          isActive: true,
          product: {
            select: {
              id: true,
              slug: true,
              status: true,
              images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
            },
          },
        },
      },
      seller: { select: { handle: true, displayName: true } },
    },
  },
  returns: { select: { status: true } },
} satisfies Prisma.OrderInclude;
type HistoryRow = Prisma.OrderGetPayload<{ include: typeof orderHistoryInclude }>;

/**
 * "Your Account" (the customer's account hub): profile, order history with actions, buy again,
 * reviews, returns, communication preferences and a copy of their data. Every query is scoped
 * to the signed-in user's id.
 */
@Injectable()
export class AccountHubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly intake: MediaIntakeService,
  ) {}

  async profile(userId: string): Promise<AccountProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarKey ? this.storage.publicUrl(user.avatarKey) : null,
      memberSince: user.createdAt.toISOString(),
      language: user.language,
    };
  }

  async setLanguage(userId: string, language: string): Promise<AccountProfile> {
    await this.prisma.user.update({ where: { id: userId }, data: { language } });
    return this.profile(userId);
  }

  /** Profile photo: a fresh upload link (images up to 5 MB). */
  avatarUpload(contentType: ImageContentType, sizeBytes: number) {
    if (sizeBytes > 5 * 1024 * 1024) {
      throw new BadRequestException('Profile photos can be up to 5 MB.');
    }
    return this.storage.createUpload(contentType, sizeBytes);
  }

  async setAvatar(userId: string, storageKey: string): Promise<AccountProfile> {
    if (!(await this.intake.ensureReady(storageKey))) {
      throw new BadRequestException('Upload the photo first.');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { avatarKey: storageKey } });
    return this.profile(userId);
  }

  async removeAvatar(userId: string): Promise<AccountProfile> {
    await this.prisma.user.update({ where: { id: userId }, data: { avatarKey: null } });
    return this.profile(userId);
  }

  /** Promotions listed in accounts, and whether the customer already used each. */
  async coupons(userId: string): Promise<AccountCoupon[]> {
    const now = new Date();
    const [coupons, used] = await Promise.all([
      this.prisma.coupon.findMany({
        where: {
          isPublic: true,
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.findMany({
        where: {
          userId,
          couponCode: { not: null },
          status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
        },
        select: { couponCode: true },
      }),
    ]);
    const usedCodes = new Set(used.map((o) => o.couponCode));
    return coupons
      .filter((c) => c.maxRedemptions === null || c.redemptionCount < c.maxRedemptions)
      .map((c) => ({
        code: c.code,
        description: c.description,
        type: c.type,
        value: c.value,
        minSubtotalCents: c.minSubtotalCents,
        endsAt: c.endsAt?.toISOString() ?? null,
        used: usedCodes.has(c.code),
      }));
  }

  async updateProfile(userId: string, input: ProfileUpdate): Promise<AccountProfile> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    });
    return this.profile(userId);
  }

  async preferences(userId: string): Promise<AccountPreferences> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        marketingEmails: true,
        reviewRequests: true,
        personalizedPicks: true,
        stockAlerts: true,
      },
    });
    return user;
  }

  async updatePreferences(userId: string, input: AccountPreferences): Promise<AccountPreferences> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: input,
      select: {
        marketingEmails: true,
        reviewRequests: true,
        personalizedPicks: true,
        stockAlerts: true,
      },
    });
    // Turning personalized picks off also forgets what was recorded for them (p10-02).
    if (input.personalizedPicks === false) {
      await this.prisma.$transaction([
        this.prisma.productEvent.deleteMany({ where: { userId } }),
        this.prisma.shopperInterest.deleteMany({ where: { userId } }),
      ]);
    }
    return updated;
  }

  async overview(userId: string): Promise<AccountOverview> {
    const [profile, user, counts, recent, buyAgain, sessions, seller, toReview] = await Promise.all(
      [
        this.profile(userId),
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { mfaEnabled: true, passwordHash: true },
        }),
        this.counts(userId),
        this.orders(userId, { filter: 'all', page: 1, pageSize: 3 }),
        this.buyAgain(userId, 8),
        this.prisma.session.count({
          where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        }),
        this.prisma.sellerMember.findUnique({
          where: { userId },
          select: { seller: { select: { handle: true, displayName: true } } },
        }),
        this.toReviewCount(userId),
      ],
    );
    return {
      profile,
      counts: { ...counts, toReview },
      recentOrders: recent.items,
      buyAgain,
      security: {
        mfaEnabled: user.mfaEnabled,
        hasPassword: user.passwordHash !== null,
        activeSessions: sessions,
      },
      seller: seller?.seller ?? null,
    };
  }

  /** Order history with filters, search and what each line allows (buy again, review, return). */
  async orders(userId: string, query: AccountOrderQuery): Promise<PagedResult<AccountOrder>> {
    const where: Prisma.OrderWhereInput = { userId, ...PLACED_NOT, AND: [] };
    const and = where.AND as Prisma.OrderWhereInput[];
    if (query.filter === 'open') and.push({ status: { in: OPEN } });
    if (query.filter === 'delivered')
      and.push({ status: { in: ['DELIVERED', 'PARTIALLY_REFUNDED'] } });
    if (query.filter === 'cancelled') and.push({ status: { in: ['CANCELLED', 'REFUNDED'] } });
    if (query.filter === 'returns') and.push({ returns: { some: {} } });
    if (query.days)
      and.push({ createdAt: { gte: new Date(Date.now() - query.days * 86_400_000) } });
    if (query.q) {
      const q = query.q.trim();
      and.push({
        OR: [
          { number: { equals: q.toUpperCase() } },
          { items: { some: { productTitle: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }
    const [total, rows, reviewed] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderHistoryInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.reviewedProductIds(userId),
    ]);
    return pagedResult(
      rows.map((row) => this.toAccountOrder(row, reviewed)),
      total,
      query,
    );
  }

  /** Products from delivered orders that are still on sale, most recently bought first. */
  async buyAgain(userId: string, limit = 24): Promise<BuyAgainItem[]> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { userId, status: { in: ['DELIVERED', 'PARTIALLY_REFUNDED', 'SHIPPED'] } },
        variant: { isActive: true, product: { status: 'ACTIVE' } },
      },
      include: {
        order: { select: { createdAt: true, currency: true } },
        variant: {
          include: {
            inventory: true,
            product: {
              select: {
                id: true,
                slug: true,
                title: true,
                images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
              },
            },
          },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
      take: 200,
    });
    const seen = new Set<string>();
    const out: BuyAgainItem[] = [];
    for (const item of items) {
      const variant = item.variant!;
      if (seen.has(variant.product.id)) continue;
      seen.add(variant.product.id);
      const image = variant.product.images[0];
      out.push({
        productId: variant.product.id,
        slug: variant.product.slug,
        title: variant.product.title,
        variantId: variant.id,
        variantTitle: variant.title,
        priceCents: variant.priceCents,
        currency: item.order.currency,
        imageUrl: image ? this.storage.publicUrl(image.storageKey) : null,
        inStock: (variant.inventory?.onHand ?? 0) - (variant.inventory?.reserved ?? 0) > 0,
        lastOrderedAt: item.order.createdAt.toISOString(),
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  async reviews(userId: string): Promise<AccountReview[]> {
    const rows = await this.prisma.review.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            title: true,
            slug: true,
            images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      body: row.body,
      status: row.status,
      verifiedPurchase: row.verifiedPurchase,
      createdAt: row.createdAt.toISOString(),
      product: {
        title: row.product.title,
        slug: row.product.slug,
        imageUrl: row.product.images[0]
          ? this.storage.publicUrl(row.product.images[0].storageKey)
          : null,
      },
    }));
  }

  /** Everything NIXZORA keeps about the customer, as one JSON document they can save. */
  async export(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        addresses: true,
        orders: { include: { items: true, returns: true }, orderBy: { createdAt: 'desc' } },
        reviews: { include: { product: { select: { title: true, slug: true } } } },
        wishlist: { include: { product: { select: { title: true, slug: true } } } },
        interests: { orderBy: { updatedAt: 'desc' }, take: 500 },
        lists: { include: { items: { include: { product: { select: { title: true } } } } } },
        paymentCards: true,
        giftEntries: { orderBy: { createdAt: 'asc' } },
        subscriptions: { include: { product: { select: { title: true } } } },
        conversations: {
          include: {
            seller: { select: { displayName: true } },
            messages: { orderBy: { createdAt: 'asc' } },
          },
        },
        identities: { select: { provider: true, createdAt: true } },
        sessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          select: { deviceName: true, userAgent: true, createdAt: true, lastUsedAt: true },
        },
      },
    });
    return {
      exportedAt: new Date().toISOString(),
      profile: {
        email: user.email,
        emailVerified: user.emailVerifiedAt !== null,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        memberSince: user.createdAt.toISOString(),
        twoStepVerification: user.mfaEnabled,
      },
      preferences: {
        marketingEmails: user.marketingEmails,
        reviewRequests: user.reviewRequests,
        personalizedPicks: user.personalizedPicks,
      },
      signInWith: user.identities.map((i) => ({
        provider: i.provider.toLowerCase(),
        linkedAt: i.createdAt.toISOString(),
      })),
      devices: user.sessions,
      addresses: user.addresses.map((a) => ({
        label: a.label,
        fullName: a.fullName,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        region: a.region,
        postalCode: a.postalCode,
        country: a.country,
        phone: a.phone,
        isDefaultShipping: a.isDefaultShipping,
      })),
      orders: user.orders.map((o) => ({
        number: o.number,
        status: o.status,
        placedAt: o.placedAt,
        currency: o.currency,
        totalCents: o.totalCents,
        shippingAddress: o.shippingAddress,
        items: o.items.map((i) => ({
          product: i.productTitle,
          option: i.variantTitle,
          sku: i.sku,
          quantity: i.quantity,
          totalCents: i.totalCents,
        })),
        returns: o.returns.map((r) => ({
          status: r.status,
          reason: r.reason,
          createdAt: r.createdAt,
          refundCents: r.refundCents,
        })),
      })),
      reviews: user.reviews.map((r) => ({
        product: r.product.title,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: r.status,
        createdAt: r.createdAt,
      })),
      wishlist: user.wishlist.map((w) => ({ product: w.product.title, savedAt: w.createdAt })),
      // Searches and needs told to the assistant, kept for personalized picks (p10-02).
      interests: user.interests.map((i) => ({
        text: i.text,
        source: i.source === 'ASSISTANT' ? 'assistant' : 'search',
        lastUsedAt: i.updatedAt,
      })),
      lists: user.lists.map((l) => ({
        name: l.name,
        kind: l.kind,
        shared: l.isShared,
        eventDate: l.eventDate,
        items: l.items.map((i) => ({
          product: i.product.title,
          quantity: i.quantity,
          note: i.note,
        })),
      })),
      // Card numbers stay with the payment provider: only what identifies the card (p10-09).
      savedCards: user.paymentCards.map((c) => ({
        brand: c.brand,
        last4: c.last4,
        expires: `${String(c.expMonth).padStart(2, '0')}/${c.expYear}`,
        savedAt: c.createdAt,
      })),
      giftCardBalance: user.giftEntries.map((e) => ({
        kind: e.kind.toLowerCase(),
        amountCents: e.amountCents,
        note: e.note,
        at: e.createdAt,
      })),
      subscriptions: user.subscriptions.map((sub) => ({
        product: sub.product.title,
        quantity: sub.quantity,
        everyDays: sub.intervalDays,
        status: sub.status.toLowerCase(),
        nextOrderAt: sub.nextOrderAt,
      })),
      messages: user.conversations.map((c) => ({
        store: c.seller.displayName,
        subject: c.subject,
        messages: c.messages.map((m) => ({
          from: m.author === 'CUSTOMER' ? 'you' : m.author === 'SELLER' ? 'store' : 'nixzora',
          body: m.body,
          at: m.createdAt,
        })),
      })),
    };
  }

  private async counts(userId: string) {
    const orderWhere = { userId, ...PLACED_NOT };
    const [orders, openOrders, openReturns, wishlist, reviews, addresses] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.count({ where: { userId, status: { in: OPEN } } }),
      this.prisma.returnRequest.count({
        where: { order: { userId }, status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] } },
      }),
      this.prisma.wishlistItem.count({ where: { userId } }),
      this.prisma.review.count({ where: { userId } }),
      this.prisma.address.count({ where: { userId } }),
    ]);
    return { orders, openOrders, openReturns, wishlist, reviews, addresses };
  }

  private async toReviewCount(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(DISTINCT p.id)::int AS n
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN product_variants pv ON pv.id = oi.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE o.user_id = ${userId}::uuid
        AND o.status IN ('DELIVERED', 'PARTIALLY_REFUNDED')
        AND p.status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.user_id = o.user_id AND r.product_id = p.id)`;
    return rows[0]?.n ?? 0;
  }

  private async reviewedProductIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.review.findMany({
      where: { userId },
      select: { productId: true },
    });
    return new Set(rows.map((r) => r.productId));
  }

  private toAccountOrder(row: HistoryRow, reviewed: Set<string>): AccountOrder {
    const delivered = row.status === 'DELIVERED' || row.status === 'PARTIALLY_REFUNDED';
    const address = row.shippingAddress as unknown as Address;
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      currency: row.currency,
      totalCents: row.totalCents,
      itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
      placedAt: row.placedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      shipTo: address?.fullName ?? '',
      tracking:
        row.trackingCarrier && row.trackingNumber
          ? {
              carrier: row.trackingCarrier,
              number: row.trackingNumber,
              url: TRACKING_URLS[row.trackingCarrier]?.(row.trackingNumber) ?? null,
            }
          : null,
      returnableUntil: returnableUntil(row),
      openReturns: row.returns.filter((r) =>
        ['REQUESTED', 'APPROVED', 'RECEIVED'].includes(r.status),
      ).length,
      lines: row.items.map((item) => {
        const product = item.variant?.product;
        const image = product?.images[0];
        const onSale = product?.status === 'ACTIVE' && item.variant?.isActive === true;
        return {
          orderItemId: item.id,
          productTitle: item.productTitle,
          variantTitle: item.variantTitle,
          quantity: item.quantity,
          totalCents: item.totalCents,
          imageUrl: image ? this.storage.publicUrl(image.storageKey) : null,
          productSlug: product?.status === 'ACTIVE' ? product.slug : null,
          variantId: onSale ? item.variant!.id : null,
          canBuyAgain: onSale,
          canReview:
            delivered && !!product && product.status === 'ACTIVE' && !reviewed.has(product.id),
          seller: item.seller,
        };
      }),
    };
  }
}
