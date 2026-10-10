import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type BundleCreate, type BundleView } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { type ActorContext } from '../identity/guards/actor.decorator';

/** Most active bundles one product can be in (the product page shows them all). */
const MAX_PER_PRODUCT = 5;

const include = {
  items: { orderBy: { position: 'asc' as const }, select: { productId: true } },
} as const;

type Row = {
  id: string;
  title: string;
  percentOff: number;
  status: 'ACTIVE' | 'ARCHIVED';
  sellerId: string | null;
  createdAt: Date;
  items: { productId: string }[];
};

/**
 * Bundle & save (p10-16): stores bundle their own single-option listings, NIXZORA staff its own,
 * at 5–30% off the set. The cart applies the discount (ADR-0038); this service creates, lists and
 * shows bundles.
 */
@Injectable()
export class BundlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
    private readonly audit: AuditService,
  ) {}

  /** Bundles a product is in, for its product page: only ones every product of which is live. */
  async forProduct(slug: string): Promise<BundleView[]> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found.');
    const rows = await this.prisma.bundle.findMany({
      where: { status: 'ACTIVE', items: { some: { productId: product.id } } },
      include,
      orderBy: { percentOff: 'desc' },
      take: MAX_PER_PRODUCT,
    });
    const views = await this.views(rows);
    return views
      .filter((view) => view.products.length === rows.find((r) => r.id === view.id)!.items.length)
      .map((view) => ({
        ...view,
        // This product first: "This item + …".
        products: [
          ...view.products.filter((p) => p.id === product.id),
          ...view.products.filter((p) => p.id !== product.id),
        ],
      }));
  }

  async list(sellerId: string | null | undefined): Promise<BundleView[]> {
    const rows = await this.prisma.bundle.findMany({
      where: sellerId === undefined ? {} : { sellerId },
      include,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.views(rows);
  }

  async create(
    input: BundleCreate,
    actor: ActorContext,
    sellerId: string | null,
  ): Promise<BundleView> {
    const products = await this.prisma.product.findMany({
      where: { id: { in: input.productIds } },
      select: {
        id: true,
        title: true,
        status: true,
        sellerId: true,
        variants: { where: { isActive: true }, select: { id: true } },
      },
    });
    if (products.length !== input.productIds.length) {
      throw new NotFoundException('One of those products doesn’t exist.');
    }
    for (const product of products) {
      if (product.sellerId !== sellerId) {
        throw new BadRequestException(
          sellerId
            ? `“${product.title}” isn’t one of your listings.`
            : `“${product.title}” is sold by a store: only NIXZORA’s own products can be bundled here.`,
        );
      }
      if (product.status !== 'ACTIVE') {
        throw new BadRequestException(`“${product.title}” isn’t live.`);
      }
      if (product.variants.length !== 1) {
        throw new BadRequestException(
          `“${product.title}” has several options (size, colour…): bundles take products with one option, so they can be added in one tap.`,
        );
      }
    }
    const key = [...input.productIds].sort().join(',');
    const same = await this.prisma.bundle.findMany({
      where: { status: 'ACTIVE', sellerId, items: { some: { productId: input.productIds[0] } } },
      include,
    });
    if (
      same.some(
        (b) =>
          b.items
            .map((i) => i.productId)
            .sort()
            .join(',') === key,
      )
    ) {
      throw new ConflictException('There is already a bundle of exactly these products.');
    }
    const row = await this.prisma.bundle.create({
      data: {
        title: input.title,
        percentOff: input.percentOff,
        sellerId,
        createdById: actor.user.id,
        items: {
          create: input.productIds.map((productId, position) => ({ productId, position })),
        },
      },
      include,
    });
    await this.audit.recordFor(
      sellerId ? { ...actor, actorType: 'USER' } : actor,
      'bundles.bundle.created',
      'bundle',
      row.id,
      { percentOff: input.percentOff, products: input.productIds.length },
    );
    return (await this.views([row]))[0]!;
  }

  async archive(id: string, actor: ActorContext, sellerId: string | null): Promise<BundleView> {
    const row = await this.prisma.bundle.findUnique({ where: { id }, include });
    if (!row || (sellerId !== null && row.sellerId !== sellerId)) {
      throw new NotFoundException('Bundle not found.');
    }
    const updated = await this.prisma.bundle.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      include,
    });
    await this.audit.recordFor(
      sellerId ? { ...actor, actorType: 'USER' } : actor,
      'bundles.bundle.archived',
      'bundle',
      id,
    );
    return (await this.views([updated]))[0]!;
  }

  private async views(rows: Row[]): Promise<BundleView[]> {
    const ids = [...new Set(rows.flatMap((row) => row.items.map((item) => item.productId)))];
    const [cards, sellers] = await Promise.all([
      this.catalog.cardsByIds(ids),
      this.prisma.seller.findMany({
        where: { id: { in: rows.map((r) => r.sellerId).filter((s): s is string => !!s) } },
        select: { id: true, handle: true, displayName: true },
      }),
    ]);
    const byId = new Map(cards.map((card) => [card.id, card]));
    return rows.map((row) => {
      const products = row.items.flatMap((item) => {
        const card = byId.get(item.productId);
        return card ? [card] : [];
      });
      const priceCents = products.reduce((sum, p) => sum + p.priceFromCents, 0);
      const seller = sellers.find((s) => s.id === row.sellerId);
      return {
        id: row.id,
        title: row.title,
        percentOff: row.percentOff,
        status: row.status,
        products,
        priceCents,
        bundlePriceCents: priceCents - Math.round((priceCents * row.percentOff) / 100),
        available:
          row.status === 'ACTIVE' &&
          products.length === row.items.length &&
          products.every((p) => p.inStock && p.defaultVariantId),
        seller: seller ? { handle: seller.handle, displayName: seller.displayName } : null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
}
