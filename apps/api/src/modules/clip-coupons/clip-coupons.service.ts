import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type ClipCouponCreate, type ClipCouponView, type CouponsPage } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { type ActorContext } from '../identity/guards/actor.decorator';

type Row = {
  id: string;
  productId: string;
  kind: 'PERCENT' | 'AMOUNT';
  percentOff: number | null;
  amountOffCents: number | null;
  startsAt: Date;
  endsAt: Date;
  maxRedemptions: number | null;
  redeemed: number;
  status: 'ACTIVE' | 'ENDED';
  sellerId: string | null;
  _count: { clips: number };
};

const include = { _count: { select: { clips: true } } } as const;

/**
 * Clip coupons (p10-18, ADR-0040): stores make them for their own listings (and fund them),
 * NIXZORA staff for NIXZORA's own; shoppers clip them, and the cart applies them (CartService).
 */
@Injectable()
export class ClipCouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
    private readonly audit: AuditService,
  ) {}

  private live(now = new Date()) {
    return { status: 'ACTIVE' as const, startsAt: { lte: now }, endsAt: { gt: now } };
  }

  /** The coupons page: every live coupon on a live product, biggest saving first. */
  async page(userId?: string): Promise<CouponsPage> {
    const rows = await this.prisma.clipCoupon.findMany({
      where: { ...this.live(), product: { status: 'ACTIVE' } },
      include,
      orderBy: [{ percentOff: 'desc' }, { amountOffCents: 'desc' }],
      take: 120,
    });
    const open = rows.filter((r) => r.maxRedemptions === null || r.redeemed < r.maxRedemptions);
    const clipped = userId
      ? (
          await this.prisma.couponClip.findMany({
            where: { userId, couponId: { in: open.map((r) => r.id) } },
            select: { couponId: true },
          })
        ).map((c) => c.couponId)
      : [];
    return { coupons: await this.views(open), clipped };
  }

  /** Ids of live coupons this shopper has clipped and not used yet. */
  async clippedIds(userId: string): Promise<string[]> {
    const clips = await this.prisma.couponClip.findMany({
      where: { userId, usedAt: null, coupon: this.live() },
      select: { couponId: true },
    });
    return clips.map((c) => c.couponId);
  }

  async clip(userId: string, couponId: string): Promise<{ clipped: true }> {
    const coupon = await this.prisma.clipCoupon.findFirst({
      where: { id: couponId, ...this.live() },
    });
    if (!coupon) throw new NotFoundException('This coupon has ended.');
    if (coupon.maxRedemptions !== null && coupon.redeemed >= coupon.maxRedemptions) {
      throw new ConflictException('This coupon has been fully used.');
    }
    const existing = await this.prisma.couponClip.findUnique({
      where: { couponId_userId: { couponId, userId } },
    });
    if (existing?.usedAt) throw new ConflictException('You’ve already used this coupon.');
    if (!existing) await this.prisma.couponClip.create({ data: { couponId, userId } });
    return { clipped: true };
  }

  async unclip(userId: string, couponId: string): Promise<void> {
    await this.prisma.couponClip.deleteMany({ where: { couponId, userId, usedAt: null } });
  }

  // ───── Stores and Ops ─────

  async list(sellerId: string | null | undefined): Promise<ClipCouponView[]> {
    const rows = await this.prisma.clipCoupon.findMany({
      where: sellerId === undefined ? {} : { sellerId },
      include,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.views(rows);
  }

  async create(
    input: ClipCouponCreate,
    actor: ActorContext,
    sellerId: string | null,
  ): Promise<ClipCouponView> {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        title: true,
        status: true,
        sellerId: true,
        variants: { where: { isActive: true }, select: { priceCents: true } },
      },
    });
    if (!product || product.status !== 'ACTIVE')
      throw new NotFoundException('That product is not live.');
    if (product.sellerId !== sellerId) {
      throw new BadRequestException(
        sellerId
          ? 'Stores can only make coupons for their own listings.'
          : 'This product is sold by a store: only NIXZORA’s own products get coupons here.',
      );
    }
    const cheapest = Math.min(...product.variants.map((v) => v.priceCents));
    if (input.kind === 'AMOUNT' && (input.amountOffCents ?? 0) >= cheapest) {
      throw new BadRequestException('The amount off must be less than the product’s price.');
    }
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const endsAt = new Date(input.endsAt);
    const overlapping = await this.prisma.clipCoupon.findFirst({
      where: {
        productId: product.id,
        status: 'ACTIVE',
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });
    if (overlapping) throw new ConflictException('This product already has a coupon at that time.');
    const row = await this.prisma.clipCoupon.create({
      data: {
        productId: product.id,
        kind: input.kind,
        percentOff: input.kind === 'PERCENT' ? input.percentOff! : null,
        amountOffCents: input.kind === 'AMOUNT' ? input.amountOffCents! : null,
        startsAt,
        endsAt,
        maxRedemptions: input.maxRedemptions ?? null,
        sellerId,
        createdById: actor.user.id,
      },
      include,
    });
    await this.audit.recordFor(
      sellerId ? { ...actor, actorType: 'USER' } : actor,
      'coupons.clip.created',
      'clip_coupon',
      row.id,
      { productId: product.id, kind: input.kind },
    );
    return (await this.views([row]))[0]!;
  }

  async end(id: string, actor: ActorContext, sellerId: string | null): Promise<ClipCouponView> {
    const row = await this.prisma.clipCoupon.findUnique({ where: { id } });
    if (!row || (sellerId !== null && row.sellerId !== sellerId)) {
      throw new NotFoundException('Coupon not found.');
    }
    const updated = await this.prisma.clipCoupon.update({
      where: { id },
      data: { status: 'ENDED' },
      include,
    });
    await this.audit.recordFor(
      sellerId ? { ...actor, actorType: 'USER' } : actor,
      'coupons.clip.ended',
      'clip_coupon',
      id,
    );
    return (await this.views([updated]))[0]!;
  }

  private async views(rows: Row[]): Promise<ClipCouponView[]> {
    const [cards, sellers] = await Promise.all([
      this.catalog.cardsByIds([...new Set(rows.map((r) => r.productId))]),
      this.prisma.seller.findMany({
        where: { id: { in: rows.map((r) => r.sellerId).filter((s): s is string => !!s) } },
        select: { id: true, handle: true, displayName: true },
      }),
    ]);
    const byId = new Map(cards.map((c) => [c.id, c]));
    return rows.flatMap((row) => {
      const product = byId.get(row.productId);
      if (!product) return [];
      const seller = sellers.find((s) => s.id === row.sellerId);
      return [
        {
          id: row.id,
          kind: row.kind,
          percentOff: row.percentOff,
          amountOffCents: row.amountOffCents,
          status: row.status,
          startsAt: row.startsAt.toISOString(),
          endsAt: row.endsAt.toISOString(),
          maxRedemptions: row.maxRedemptions,
          redeemed: row.redeemed,
          clips: row._count.clips,
          product,
          seller: seller ? { handle: seller.handle, displayName: seller.displayName } : null,
        },
      ];
    });
  }
}
