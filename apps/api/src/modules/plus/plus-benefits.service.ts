import { Injectable } from '@nestjs/common';
import { PLUS_EARLY_ACCESS_MINUTES, PLUS_GRACE_DAYS } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { dealPrice } from '../deals/deal-price';

const DAY_MS = 86_400_000;

type MembershipState = {
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'ENDED';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

/**
 * Whether a membership gives benefits now. A renewal is charged when the period ends, so a
 * member keeps the benefits through the grace period while it is retried; a member who is
 * leaving keeps them to the end of what they paid for.
 */
export function plusActive(m: MembershipState | null | undefined, now = new Date()): boolean {
  if (!m || m.status === 'ENDED') return false;
  const grace = m.cancelAtPeriodEnd ? 0 : PLUS_GRACE_DAYS * DAY_MS;
  return m.currentPeriodEnd.getTime() + grace > now.getTime();
}

/**
 * NIXZORA Plus benefits (p10-15) as the cart and checkout apply them. Only reads: billing lives
 * in PlusService.
 */
@Injectable()
export class PlusBenefits {
  constructor(private readonly prisma: PrismaService) {}

  async isMember(userId: string, now = new Date()): Promise<boolean> {
    const membership = await this.prisma.plusMembership.findUnique({
      where: { userId },
      select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    });
    return plusActive(membership, now);
  }

  /**
   * Member prices for these variants now: live member-only deals, and lightning deals Plus
   * members can buy 30 minutes before they open to everyone. Variants with neither are absent.
   */
  async memberPrices(
    variants: { id: string; productId: string; priceCents: number }[],
    now = new Date(),
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    if (!variants.length) return prices;
    const deals = await this.prisma.deal.findMany({
      where: {
        productId: { in: [...new Set(variants.map((v) => v.productId))] },
        OR: [
          { status: 'LIVE', audience: 'PLUS' },
          {
            status: 'SCHEDULED',
            kind: 'LIGHTNING',
            audience: 'EVERYONE',
            startsAt: {
              gt: now,
              lte: new Date(now.getTime() + PLUS_EARLY_ACCESS_MINUTES * 60_000),
            },
            endsAt: { gt: now },
          },
        ],
      },
      select: { productId: true, percentOff: true, quantity: true, claimed: true },
    });
    const byProduct = new Map(
      deals
        .filter((deal) => deal.quantity === null || deal.claimed < deal.quantity)
        .map((deal) => [deal.productId, deal.percentOff]),
    );
    for (const variant of variants) {
      const percent = byProduct.get(variant.productId);
      if (percent) prices.set(variant.id, dealPrice(variant.priceCents, percent));
    }
    return prices;
  }
}
