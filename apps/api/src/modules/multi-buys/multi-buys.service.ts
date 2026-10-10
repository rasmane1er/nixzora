import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type MultiBuyCreate, multiBuyText, type MultiBuyView } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { type ActorContext } from '../identity/guards/actor.decorator';

const DAY_MS = 86_400_000;
const include = { products: { select: { productId: true } } } as const;

type Row = {
  id: string;
  buyQty: number;
  getQty: number;
  percentOff: number;
  status: 'ACTIVE' | 'ENDED';
  sellerId: string | null;
  endsAt: Date | null;
  createdAt: Date;
  products: { productId: string }[];
};

/** Live: active and not past its end. */
export const liveMultiBuy = (now = new Date()) => ({
  status: 'ACTIVE' as const,
  OR: [{ endsAt: null }, { endsAt: { gt: now } }],
});

/**
 * Buy X, get Y (p10-27, ADR-0049): stores make offers on their own listings, NIXZORA staff on
 * NIXZORA's. The cart applies them; this service creates, lists, shows and ends them.
 */
@Injectable()
export class MultiBuysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
    private readonly audit: AuditService,
  ) {}

  /** The offer page: its live products. */
  async show(id: string): Promise<MultiBuyView> {
    const row = await this.prisma.multiBuy.findFirst({
      where: { id, ...liveMultiBuy() },
      include,
    });
    if (!row) throw new NotFoundException('This offer has ended.');
    const [view] = await this.views([row], true);
    return view!;
  }

  /** Live offers for the Deals page: newest first, only ones with something in stock. */
  async live(): Promise<MultiBuyView[]> {
    const rows = await this.prisma.multiBuy.findMany({
      where: liveMultiBuy(),
      include,
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    return (await this.views(rows, true)).filter((view) => view.products.length);
  }

  async list(sellerId: string | null | undefined): Promise<MultiBuyView[]> {
    const rows = await this.prisma.multiBuy.findMany({
      where: sellerId === undefined ? {} : { sellerId },
      include,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.views(rows, false);
  }

  async create(
    input: MultiBuyCreate,
    actor: ActorContext,
    sellerId: string | null,
  ): Promise<MultiBuyView> {
    const products = await this.prisma.product.findMany({
      where: { id: { in: input.productIds } },
      select: { id: true, title: true, status: true, sellerId: true },
    });
    if (products.length !== input.productIds.length) {
      throw new NotFoundException('One of those products doesn’t exist.');
    }
    for (const product of products) {
      if (product.sellerId !== sellerId) {
        throw new BadRequestException(
          sellerId
            ? `“${product.title}” isn’t one of your listings.`
            : `“${product.title}” is sold by a store: only NIXZORA’s own products can be in an offer here.`,
        );
      }
      if (product.status !== 'ACTIVE') {
        throw new BadRequestException(`“${product.title}” isn’t live.`);
      }
    }
    // One live offer per product, so the cart never has to choose between two.
    const taken = await this.prisma.multiBuyProduct.findFirst({
      where: { productId: { in: input.productIds }, multiBuy: liveMultiBuy() },
      select: { product: { select: { title: true } } },
    });
    if (taken) {
      throw new ConflictException(
        `“${taken.product.title}” is already in a live offer. End that one first.`,
      );
    }
    const row = await this.prisma.multiBuy.create({
      data: {
        buyQty: input.buyQty,
        getQty: input.getQty,
        percentOff: input.percentOff,
        sellerId,
        endsAt: input.days ? new Date(Date.now() + input.days * DAY_MS) : null,
        createdById: actor.user.id,
        products: { create: input.productIds.map((productId) => ({ productId })) },
      },
      include,
    });
    await this.audit.recordFor(
      sellerId ? { ...actor, actorType: 'USER' } : actor,
      'promotions.multi_buy.created',
      'multi_buy',
      row.id,
      { terms: multiBuyText(input), products: input.productIds.length, days: input.days ?? null },
    );
    return (await this.views([row], false))[0]!;
  }

  async end(id: string, actor: ActorContext, sellerId: string | null): Promise<MultiBuyView> {
    const row = await this.prisma.multiBuy.findUnique({ where: { id }, include });
    if (!row || (sellerId !== null && row.sellerId !== sellerId)) {
      throw new NotFoundException('Offer not found.');
    }
    const updated = await this.prisma.multiBuy.update({
      where: { id },
      data: { status: 'ENDED' },
      include,
    });
    await this.audit.recordFor(
      sellerId ? { ...actor, actorType: 'USER' } : actor,
      'promotions.multi_buy.ended',
      'multi_buy',
      id,
    );
    return (await this.views([updated], false))[0]!;
  }

  private async views(rows: Row[], liveOnly: boolean): Promise<MultiBuyView[]> {
    if (!rows.length) return [];
    const ids = [...new Set(rows.flatMap((row) => row.products.map((p) => p.productId)))];
    const [cards, sellers, uses] = await Promise.all([
      this.catalog.cardsByIds(ids),
      this.prisma.seller.findMany({
        where: { id: { in: rows.map((r) => r.sellerId).filter((s): s is string => !!s) } },
        select: { id: true, handle: true, displayName: true },
      }),
      // Paid orders that used each offer.
      this.prisma.$queryRaw<{ id: string; orders: bigint }[]>`
        SELECT k.id, COUNT(*) AS orders
        FROM orders o, jsonb_object_keys(o.multi_buy_uses) AS k(id)
        WHERE o.multi_buy_uses IS NOT NULL
          AND k.id = ANY(${rows.map((r) => r.id)})
          AND o.status::text NOT IN ('PENDING_PAYMENT', 'CANCELLED')
        GROUP BY k.id`,
    ]);
    const byId = new Map(cards.map((card) => [card.id, card]));
    const used = new Map(uses.map((u) => [u.id, Number(u.orders)]));
    const now = Date.now();
    return rows.map((row) => {
      const seller = sellers.find((s) => s.id === row.sellerId);
      const ended = row.status === 'ENDED' || (row.endsAt !== null && row.endsAt.getTime() <= now);
      return {
        id: row.id,
        buyQty: row.buyQty,
        getQty: row.getQty,
        percentOff: row.percentOff,
        status: ended ? 'ENDED' : 'ACTIVE',
        endsAt: row.endsAt?.toISOString() ?? null,
        products: row.products.flatMap((p) => {
          const card = byId.get(p.productId);
          return card && (!liveOnly || card.inStock) ? [card] : [];
        }),
        seller: seller ? { handle: seller.handle, displayName: seller.displayName } : null,
        orders: used.get(row.id) ?? 0,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
}
