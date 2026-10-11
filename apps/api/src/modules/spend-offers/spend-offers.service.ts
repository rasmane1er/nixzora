import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type SpendOfferBrief,
  type SpendOfferCreate,
  type SpendOfferView,
  type SpendRule,
  type SpendTier,
  spendText,
} from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';

const DAY_MS = 86_400_000;

type Row = {
  id: string;
  tiers: unknown;
  status: 'ACTIVE' | 'ENDED';
  sellerId: string | null;
  endsAt: Date | null;
  createdAt: Date;
};

/** Live: active and not past its end. */
export const liveSpendOffer = (now = new Date()) => ({
  status: 'ACTIVE' as const,
  OR: [{ endsAt: null }, { endsAt: { gt: now } }],
});

/** Tiers as stored (JSON), lowest spend first. */
export function tiersOf(value: unknown): SpendTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (t): t is SpendTier =>
        typeof t === 'object' &&
        t !== null &&
        Number.isInteger((t as SpendTier).minCents) &&
        Number.isInteger((t as SpendTier).offCents),
    )
    .map(({ minCents, offCents }) => ({ minCents, offCents }))
    .sort((a, b) => a.minCents - b.minCents);
}

/**
 * Spend more, save more (p10-31, ADR-0054): stores set tiers on everything they sell, NIXZORA
 * staff on NIXZORA's own range. The cart applies them; this service creates, lists and ends them.
 */
@Injectable()
export class SpendOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The live offers of these stores ('' or null = NIXZORA), for the cart and checkout. */
  async rules(sellerIds: readonly (string | null)[], now = new Date()): Promise<SpendRule[]> {
    if (!sellerIds.length) return [];
    const stores = sellerIds.filter((s): s is string => !!s);
    const own = sellerIds.some((s) => !s);
    const rows = await this.prisma.spendOffer.findMany({
      where: {
        ...liveSpendOffer(now),
        AND: [
          {
            OR: [
              ...(stores.length ? [{ sellerId: { in: stores } }] : []),
              ...(own ? [{ sellerId: null }] : []),
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    // One live offer per store; should two ever overlap, the newest wins.
    const seen = new Set<string>();
    return rows.flatMap((row) => {
      const key = row.sellerId ?? '';
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ id: row.id, sellerId: row.sellerId, tiers: tiersOf(row.tiers) }];
    });
  }

  /** On a product page: the live offer of the store that sells it. */
  async briefFor(sellerId: string | null): Promise<SpendOfferBrief | null> {
    const row = await this.prisma.spendOffer.findFirst({
      where: { ...liveSpendOffer(), sellerId },
      orderBy: { createdAt: 'desc' },
    });
    return row
      ? { id: row.id, tiers: tiersOf(row.tiers), endsAt: row.endsAt?.toISOString() ?? null }
      : null;
  }

  /** Live offers for the Deals page, newest first. */
  async live(): Promise<SpendOfferView[]> {
    const rows = await this.prisma.spendOffer.findMany({
      where: liveSpendOffer(),
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    return this.views(rows);
  }

  async list(sellerId: string | null | undefined): Promise<SpendOfferView[]> {
    const rows = await this.prisma.spendOffer.findMany({
      where: sellerId === undefined ? {} : { sellerId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.views(rows);
  }

  async create(
    input: SpendOfferCreate,
    actor: ActorContext,
    sellerId: string | null,
  ): Promise<SpendOfferView> {
    const tiers = [...input.tiers].sort((a, b) => a.minCents - b.minCents);
    const row = await this.prisma.$transaction(async (tx) => {
      // One live offer per store: two editors saving at once can't both start one.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`spend:${sellerId ?? ''}`}))`;
      const live = await tx.spendOffer.findFirst({
        where: { ...liveSpendOffer(), sellerId },
        select: { id: true },
      });
      if (live) {
        throw new ConflictException(
          'There’s already a live Spend more, save more offer. End it first.',
        );
      }
      return tx.spendOffer.create({
        data: {
          tiers,
          sellerId,
          endsAt: input.days ? new Date(Date.now() + input.days * DAY_MS) : null,
          createdById: actor.user.id,
        },
      });
    });
    await this.audit.recordFor(
      sellerId ? { ...actor, actorType: 'USER' } : actor,
      'promotions.spend_offer.created',
      'spend_offer',
      row.id,
      { terms: spendText(tiers), days: input.days ?? null },
    );
    return (await this.views([row]))[0]!;
  }

  async end(id: string, actor: ActorContext, sellerId: string | null): Promise<SpendOfferView> {
    const row = await this.prisma.spendOffer.findUnique({ where: { id } });
    if (!row || (sellerId !== null && row.sellerId !== sellerId)) {
      throw new NotFoundException('Offer not found.');
    }
    const updated = await this.prisma.spendOffer.update({
      where: { id },
      data: { status: 'ENDED' },
    });
    await this.audit.recordFor(
      sellerId ? { ...actor, actorType: 'USER' } : actor,
      'promotions.spend_offer.ended',
      'spend_offer',
      id,
    );
    return (await this.views([updated]))[0]!;
  }

  /** Store names for these sellers (cart and views). */
  async stores(
    sellerIds: readonly (string | null)[],
  ): Promise<Map<string, { handle: string; displayName: string }>> {
    const ids = sellerIds.filter((s): s is string => !!s);
    if (!ids.length) return new Map();
    const rows = await this.prisma.seller.findMany({
      where: { id: { in: ids } },
      select: { id: true, handle: true, displayName: true },
    });
    return new Map(rows.map((r) => [r.id, { handle: r.handle, displayName: r.displayName }]));
  }

  private async views(rows: Row[]): Promise<SpendOfferView[]> {
    if (!rows.length) return [];
    const [stores, uses] = await Promise.all([
      this.stores(rows.map((r) => r.sellerId)),
      // Paid orders that used each offer.
      this.prisma.$queryRaw<{ id: string; orders: bigint }[]>`
        SELECT k.id, COUNT(*) AS orders
        FROM orders o, jsonb_object_keys(o.spend_uses) AS k(id)
        WHERE o.spend_uses IS NOT NULL
          AND k.id = ANY(${rows.map((r) => r.id)})
          AND o.status::text NOT IN ('PENDING_PAYMENT', 'CANCELLED')
        GROUP BY k.id`,
    ]);
    const used = new Map(uses.map((u) => [u.id, Number(u.orders)]));
    const now = Date.now();
    return rows.map((row) => {
      const ended = row.status === 'ENDED' || (row.endsAt !== null && row.endsAt.getTime() <= now);
      return {
        id: row.id,
        tiers: tiersOf(row.tiers),
        status: ended ? 'ENDED' : 'ACTIVE',
        endsAt: row.endsAt?.toISOString() ?? null,
        seller: row.sellerId ? (stores.get(row.sellerId) ?? null) : null,
        orders: used.get(row.id) ?? 0,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
}
