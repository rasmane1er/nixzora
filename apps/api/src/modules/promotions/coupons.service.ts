import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type CouponCreate, type CouponUpdate, type CouponView } from '@nixzora/validation';
import { type Coupon, type Prisma } from '../../generated/prisma/client';
import { isUniqueViolation } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';

export type CouponCheck =
  | { ok: true; coupon: Coupon; discountCents: number }
  | { ok: false; problem: string; coupon: Coupon | null };

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function toCouponView(coupon: Coupon): CouponView {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    type: coupon.type,
    value: coupon.value,
    minSubtotalCents: coupon.minSubtotalCents,
    maxRedemptions: coupon.maxRedemptions,
    redemptionCount: coupon.redemptionCount,
    startsAt: coupon.startsAt?.toISOString() ?? null,
    endsAt: coupon.endsAt?.toISOString() ?? null,
    isActive: coupon.isActive,
    isPublic: coupon.isPublic,
    createdAt: coupon.createdAt.toISOString(),
  };
}

/** Discount codes: validation for carts and checkout, and the Ops Center's management. */
@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Whether a code applies to a cart with this merchandise subtotal, and how much it takes off. */
  async check(code: string, subtotalCents: number, now = new Date()): Promise<CouponCheck> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon || !coupon.isActive)
      return { ok: false, problem: 'That code is not valid.', coupon };
    if (coupon.startsAt && coupon.startsAt > now)
      return { ok: false, problem: 'That code is not active yet.', coupon };
    if (coupon.endsAt && coupon.endsAt <= now)
      return { ok: false, problem: 'That code has expired.', coupon };
    if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
      return { ok: false, problem: 'That code has been fully used.', coupon };
    }
    if (subtotalCents < coupon.minSubtotalCents) {
      return {
        ok: false,
        problem: `Spend ${money(coupon.minSubtotalCents)} or more to use ${coupon.code}.`,
        coupon,
      };
    }
    const raw =
      coupon.type === 'PERCENT'
        ? Math.round((subtotalCents * coupon.value) / 10_000)
        : coupon.value;
    return { ok: true, coupon, discountCents: Math.min(raw, subtotalCents) };
  }

  /**
   * Inside the checkout transaction: count one use, unless the limit was reached meanwhile.
   * Returns false when the last use was just taken by someone else.
   */
  async redeem(tx: Prisma.TransactionClient, couponId: string): Promise<boolean> {
    const updated = await tx.$executeRaw`
      UPDATE coupons SET redemption_count = redemption_count + 1, updated_at = now()
      WHERE id = ${couponId}::uuid AND is_active
        AND (max_redemptions IS NULL OR redemption_count < max_redemptions)`;
    return updated === 1;
  }

  /** An unpaid order using the code was cancelled: give the use back. */
  async release(code: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE coupons SET redemption_count = GREATEST(redemption_count - 1, 0), updated_at = now()
      WHERE code = ${code}`;
  }

  // ───── Ops Center ─────

  async list(): Promise<CouponView[]> {
    const rows = await this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    return rows.map(toCouponView);
  }

  async create(input: CouponCreate, actor: ActorContext): Promise<CouponView> {
    try {
      const coupon = await this.prisma.coupon.create({
        data: {
          code: input.code,
          description: input.description ?? null,
          type: input.type,
          value: input.value,
          minSubtotalCents: input.minSubtotalCents,
          maxRedemptions: input.maxRedemptions ?? null,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          isActive: input.isActive,
          isPublic: input.isPublic,
        },
      });
      await this.record('promotions.coupon.created', coupon.id, actor, { code: coupon.code });
      return toCouponView(coupon);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('A coupon with that code already exists.');
      throw error;
    }
  }

  async update(id: string, input: CouponUpdate, actor: ActorContext): Promise<CouponView> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found.');
    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.maxRedemptions !== undefined ? { maxRedemptions: input.maxRedemptions } : {}),
        ...(input.endsAt !== undefined
          ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      },
    });
    await this.record('promotions.coupon.updated', id, actor, {
      code: coupon.code,
      changes: Object.keys(input),
    });
    return toCouponView(coupon);
  }

  private record(
    action: string,
    id: string,
    actor: ActorContext,
    metadata: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      actorId: actor.user.id,
      entityType: 'coupon',
      entityId: id,
      meta: actor.meta,
      metadata,
    });
  }
}
