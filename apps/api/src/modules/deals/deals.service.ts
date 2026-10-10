import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type DealCreate,
  type DealListQuery,
  type DealsPage,
  type DealView,
  PLUS_EARLY_ACCESS_MINUTES,
} from '@nixzora/validation';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { dealPrice } from './deal-price';
import { type Env } from '../../config/env';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { StorageService } from '../media/storage.service';
import { OutboxService } from '../outbox/outbox.service';

const TICK_MS = 60_000;

const dealInclude = {
  product: {
    select: {
      id: true,
      slug: true,
      title: true,
      sellerId: true,
      images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
      seller: { select: { handle: true, displayName: true } },
    },
  },
} satisfies Prisma.DealInclude;
type DealRow = Prisma.DealGetPayload<{ include: typeof dealInclude }>;

type Originals = Record<string, [number, number | null]>;

/** The deal price: whole cents, never below one. */
/** Plus members can buy this scheduled lightning deal now (30 minutes early, p10-15). */
export function inEarlyAccess(
  deal: { kind: string; audience: string; startsAt: Date },
  now = new Date(),
): boolean {
  return (
    deal.kind === 'LIGHTNING' &&
    deal.audience === 'EVERYONE' &&
    deal.startsAt.getTime() > now.getTime() &&
    deal.startsAt.getTime() - now.getTime() <= PLUS_EARLY_ACCESS_MINUTES * 60_000
  );
}

export { dealPrice };

/**
 * Deals (p10-07). Every minute, due deals go live (each variant's price drops by the percentage
 * and its regular price becomes the "was" price) and finished ones end (prices restored). A
 * lightning deal with a quantity also ends once that many units sold. While a deal is live,
 * the product's prices cannot be edited, so restoring never overwrites a change.
 */
@Injectable()
export class DealsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DealsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    this.outbox.on('order.paid', ({ aggregateId }) => this.claim(aggregateId));
    if (!runsBackgroundJobs(this.config)) return;
    this.timer = setInterval(() => void this.tick().catch(() => undefined), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ───── Creating ─────

  /** `sellerId`: the store creating it (only its own products); null for staff. */
  async create(input: DealCreate, actor: ActorContext, sellerId: string | null): Promise<DealView> {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, status: 'ACTIVE' },
      select: { id: true, sellerId: true },
    });
    if (!product) throw new NotFoundException('That product is not live.');
    if (sellerId && product.sellerId !== sellerId) {
      throw new ForbiddenException('Stores can only put their own products on deal.');
    }
    if (Date.parse(input.endsAt) <= Date.now()) {
      throw new BadRequestException('The deal must end in the future.');
    }
    const overlapping = await this.prisma.deal.findFirst({
      where: {
        productId: product.id,
        status: { in: ['SCHEDULED', 'LIVE'] },
        startsAt: { lt: new Date(input.endsAt) },
        endsAt: { gt: new Date(input.startsAt) },
      },
      select: { id: true },
    });
    if (overlapping) throw new ConflictException('This product already has a deal at that time.');

    const deal = await this.prisma.deal.create({
      data: {
        productId: product.id,
        kind: input.kind,
        percentOff: input.percentOff,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        quantity: input.quantity ?? null,
        audience: input.audience ?? 'EVERYONE',
        sellerId,
        createdById: actor.user.id,
      },
      include: dealInclude,
    });
    await this.audit.recordFor(
      sellerId ? { ...actor, actorType: 'USER' } : actor,
      'deals.deal.created',
      'deal',
      deal.id,
      {
        productId: product.id,
        percentOff: input.percentOff,
        kind: input.kind,
        audience: input.audience ?? 'EVERYONE',
      },
    );
    // A deal starting now goes live at once rather than at the next minute.
    if (deal.startsAt.getTime() <= Date.now()) await this.tick();
    return this.view(
      await this.prisma.deal.findUniqueOrThrow({ where: { id: deal.id }, include: dealInclude }),
    );
  }

  async cancel(id: string, actor: ActorContext, sellerId: string | null): Promise<DealView> {
    const deal = await this.prisma.deal.findUnique({ where: { id }, include: dealInclude });
    if (!deal || (sellerId && deal.sellerId !== sellerId && deal.product.sellerId !== sellerId)) {
      throw new NotFoundException('Deal not found.');
    }
    if (deal.status === 'LIVE') await this.end(deal.id, 'CANCELLED');
    else if (deal.status === 'SCHEDULED') {
      await this.prisma.deal.update({ where: { id }, data: { status: 'CANCELLED' } });
    }
    await this.audit.recordFor(
      sellerId ? { ...actor, actorType: 'USER' } : actor,
      'deals.deal.cancelled',
      'deal',
      id,
    );
    return this.view(
      await this.prisma.deal.findUniqueOrThrow({ where: { id }, include: dealInclude }),
    );
  }

  async list(where: { sellerId?: string }): Promise<DealView[]> {
    const rows = await this.prisma.deal.findMany({
      where: where.sellerId ? { product: { sellerId: where.sellerId } } : {},
      include: dealInclude,
      orderBy: [{ startsAt: 'desc' }],
      take: 200,
    });
    return rows.map((row) => this.view(row));
  }

  // ───── Shoppers ─────

  async page(query: DealListQuery, now = new Date()): Promise<DealsPage> {
    const categoryIds = query.category
      ? await this.catalog.categoryAndDescendantIds(query.category)
      : null;
    const product = categoryIds ? { categoryId: { in: categoryIds } } : {};
    const [live, upcoming] = await Promise.all([
      this.prisma.deal.findMany({
        where: { status: 'LIVE', ...(query.kind ? { kind: query.kind } : {}), product },
        orderBy: { endsAt: 'asc' },
        take: 60,
        select: { productId: true },
      }),
      this.prisma.deal.findMany({
        where: {
          status: 'SCHEDULED',
          startsAt: { gt: now, lt: new Date(now.getTime() + 48 * 3_600_000) },
          ...(query.kind ? { kind: query.kind } : {}),
          product,
        },
        orderBy: { startsAt: 'asc' },
        take: 12,
        select: {
          productId: true,
          startsAt: true,
          percentOff: true,
          kind: true,
          audience: true,
        },
      }),
    ]);
    const liveCards = await this.catalog.cardsByIds(live.map((d) => d.productId));
    const upcomingCards = new Map(
      (await this.catalog.cardsByIds(upcoming.map((d) => d.productId))).map((c) => [c.id, c]),
    );
    return {
      live: liveCards.filter((card) => card.deal),
      upcoming: upcoming.flatMap((d) => {
        const card = upcomingCards.get(d.productId);
        return card
          ? [
              {
                product: card,
                startsAt: d.startsAt.toISOString(),
                percentOff: d.percentOff,
                kind: d.kind,
                earlyAccess: inEarlyAccess(d, now),
              },
            ]
          : [];
      }),
    };
  }

  // ───── Running ─────

  /** Starts due deals and ends finished ones. Safe to run at any time, from any process. */
  async tick(now = new Date()): Promise<{ started: number; ended: number }> {
    let started = 0;
    let ended = 0;
    const finished = await this.prisma.deal.findMany({
      where: { status: 'LIVE', endsAt: { lte: now } },
      select: { id: true },
    });
    for (const deal of finished) if (await this.end(deal.id, 'ENDED')) ended++;
    const due = await this.prisma.deal.findMany({
      where: { status: 'SCHEDULED', startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: 'asc' },
      select: { id: true },
    });
    for (const deal of due) if (await this.start(deal.id)) started++;
    // Scheduled deals whose time passed without starting (e.g. product paused) just end.
    await this.prisma.deal.updateMany({
      where: { status: 'SCHEDULED', endsAt: { lte: now } },
      data: { status: 'ENDED' },
    });
    if (started || ended) this.logger.log(`Deals: ${started} started, ${ended} ended`);
    return { started, ended };
  }

  private async start(id: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`deal:${id}`}))`;
      const deal = await tx.deal.findUnique({ where: { id } });
      if (deal?.status !== 'SCHEDULED') return false;
      const product = await tx.product.findUnique({
        where: { id: deal.productId },
        select: {
          status: true,
          variants: { select: { id: true, priceCents: true, compareAtCents: true } },
        },
      });
      const busy = await tx.deal.count({ where: { productId: deal.productId, status: 'LIVE' } });
      if (product?.status !== 'ACTIVE' || busy) return false;

      const originals: Originals = {};
      // Member-only deals (p10-15) leave the listed price alone: members pay less at the cart.
      for (const variant of deal.audience === 'PLUS' ? [] : product.variants) {
        originals[variant.id] = [variant.priceCents, variant.compareAtCents];
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            priceCents: dealPrice(variant.priceCents, deal.percentOff),
            // The "was" price shown is the regular price (or an earlier, higher one).
            compareAtCents: Math.max(variant.priceCents, variant.compareAtCents ?? 0),
          },
        });
      }
      await tx.deal.update({
        where: { id },
        data: { status: 'LIVE', originalPrices: originals as Prisma.InputJsonObject },
      });
      await this.changed(tx, deal.productId);
      // Follow stores (p10-24): the store's followers hear about it.
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'deal',
          aggregateId: id,
          type: 'deal.started',
          payload: {
            productId: deal.productId,
            sellerId: deal.sellerId,
            percentOff: deal.percentOff,
          },
        },
      });
      return true;
    });
  }

  private async end(id: string, status: 'ENDED' | 'CANCELLED'): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`deal:${id}`}))`;
      const deal = await tx.deal.findUnique({ where: { id } });
      if (deal?.status !== 'LIVE') return false;
      const originals = (deal.originalPrices ?? {}) as Originals;
      for (const [variantId, [price, compareAt]] of Object.entries(originals)) {
        await tx.productVariant.updateMany({
          where: { id: variantId },
          data: { priceCents: price, compareAtCents: compareAt },
        });
      }
      await tx.deal.update({ where: { id }, data: { status } });
      await this.changed(tx, deal.productId);
      return true;
    });
  }

  /** A paid order counts its units against live limited deals; a sold-out deal ends. */
  async claim(orderId: string): Promise<void> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: { quantity: true, variant: { select: { productId: true } } },
    });
    const units = new Map<string, number>();
    for (const item of items) {
      if (!item.variant) continue;
      units.set(item.variant.productId, (units.get(item.variant.productId) ?? 0) + item.quantity);
    }
    const now = new Date();
    for (const [productId, quantity] of units) {
      // A live deal, or a lightning deal Plus members are buying early (p10-15).
      const deal =
        (await this.prisma.deal.findFirst({ where: { productId, status: 'LIVE' } })) ??
        (await this.prisma.deal.findFirst({
          where: {
            productId,
            status: 'SCHEDULED',
            kind: 'LIGHTNING',
            audience: 'EVERYONE',
            startsAt: { lte: new Date(now.getTime() + PLUS_EARLY_ACCESS_MINUTES * 60_000) },
          },
        }));
      if (!deal) continue;
      const updated = await this.prisma.deal.update({
        where: { id: deal.id },
        data: { claimed: { increment: quantity } },
      });
      if (updated.quantity !== null && updated.claimed >= updated.quantity) {
        if (updated.status === 'LIVE') await this.end(deal.id, 'ENDED');
        else {
          // Sold out to members before it opened to everyone.
          await this.prisma.deal.updateMany({
            where: { id: deal.id, status: 'SCHEDULED' },
            data: { status: 'ENDED' },
          });
        }
      }
    }
  }

  /** Re-index the product (prices changed) through the usual catalog event. */
  private async changed(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: productId,
        type: 'catalog.product.updated',
        payload: { productId, reason: 'deal' },
      },
    });
  }

  private view(row: DealRow): DealView {
    const image = row.product.images[0];
    return {
      id: row.id,
      kind: row.kind,
      percentOff: row.percentOff,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      quantity: row.quantity,
      claimed: row.claimed,
      status: row.status,
      audience: row.audience,
      product: {
        id: row.product.id,
        slug: row.product.slug,
        title: row.product.title,
        imageUrl: image ? this.storage.publicUrl(image.storageKey) : null,
      },
      seller: row.product.seller,
    };
  }
}
