import { BadRequestException, Injectable } from '@nestjs/common';
import {
  LISTING_IMPORT_COLUMNS,
  type ListingImportRequest,
  type ListingImportResult,
} from '@nixzora/validation';
import { csvCell, parseCsv } from '../../common/csv';
import { isUniqueViolation } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CatalogAdminService } from '../catalog/catalog-admin.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { InventoryService } from '../inventory/inventory.service';
import { planImport } from './listing-import';
import { SellersService } from './sellers.service';

/** Bulk listing import and export for sellers (p7-03). Rules live in listing-import.ts. */
@Injectable()
export class SellerImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sellers: SellersService,
    private readonly catalog: CatalogAdminService,
    private readonly inventory: InventoryService,
  ) {}

  /** A header row and two example rows. */
  template(): string {
    return [
      LISTING_IMPORT_COLUMNS.join(','),
      [
        'amp',
        'Copperline tube amp',
        'speakers',
        'A 2x8W single-ended tube amplifier with a walnut base.',
        'power_w: 8; tubes: EL84',
        'CPL-AMP-BLK',
        'Black',
        '599.00',
        '',
        '3',
        '',
      ]
        .map(csvCell)
        .join(','),
      ['amp', '', '', '', '', 'CPL-AMP-WAL', 'Walnut', '649.00', '', '2', '']
        .map(csvCell)
        .join(','),
      '',
    ].join('\r\n');
  }

  /** Every option the store lists, in the import format, for editing and re-uploading. */
  async exportCsv(actor: ActorContext): Promise<string> {
    const { seller } = await this.sellers.require(actor.user.id);
    const products = await this.prisma.product.findMany({
      where: { sellerId: seller.id },
      include: {
        category: { select: { slug: true } },
        variants: { include: { inventory: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const lines = [LISTING_IMPORT_COLUMNS.join(',')];
    for (const product of products) {
      const specs = Object.entries((product.attributes ?? {}) as Record<string, unknown>)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join('; ');
      product.variants.forEach((variant, i) => {
        lines.push(
          [
            product.slug,
            i === 0 ? product.title : '',
            i === 0 ? product.category.slug : '',
            i === 0 ? product.description : '',
            i === 0 ? specs : '',
            variant.sku,
            variant.title,
            (variant.priceCents / 100).toFixed(2),
            variant.compareAtCents == null ? '' : (variant.compareAtCents / 100).toFixed(2),
            variant.inventory?.onHand ?? 0,
            variant.barcode ?? '',
          ]
            .map(csvCell)
            .join(','),
        );
      });
    }
    return `${lines.join('\r\n')}\r\n`;
  }

  async run(input: ListingImportRequest, actor: ActorContext): Promise<ListingImportResult> {
    const { seller } = await this.sellers.require(actor.user.id, { write: true });
    let table: string[][];
    try {
      table = parseCsv(input.csv);
    } catch (error) {
      throw new BadRequestException(`The file could not be read: ${(error as Error).message}`);
    }
    const skus = [
      ...new Set(
        table
          .slice(1)
          .flatMap((row) => row)
          .map((cell) => cell.trim().toUpperCase())
          .filter((cell) => /^[A-Z0-9][A-Z0-9-]{2,63}$/.test(cell)),
      ),
    ];
    const [categories, variants] = await Promise.all([
      this.prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, slug: true },
      }),
      this.prisma.productVariant.findMany({
        where: { sku: { in: skus } },
        select: {
          id: true,
          sku: true,
          priceCents: true,
          compareAtCents: true,
          product: { select: { sellerId: true } },
          inventory: true,
        },
      }),
    ]);
    const own = variants.filter((variant) => variant.product.sellerId === seller.id);
    const plan = planImport(table, {
      categories: new Map(categories.map((category) => [category.slug, category.id])),
      ownSkus: new Map(
        own.map((variant) => [
          variant.sku,
          {
            variantId: variant.id,
            priceCents: variant.priceCents,
            compareAtCents: variant.compareAtCents,
            onHand: variant.inventory?.onHand ?? 0,
            reserved: variant.inventory?.reserved ?? 0,
          },
        ]),
      ),
      takenSkus: new Set(
        variants
          .filter((variant) => variant.product.sellerId !== seller.id)
          .map((variant) => variant.sku),
      ),
    });

    const result: ListingImportResult = {
      dryRun: input.dryRun || plan.errors.length > 0,
      rows: plan.rows,
      newListings: plan.creates.length,
      newOptions: plan.creates.reduce((sum, create) => sum + create.product.variants.length, 0),
      updatedOptions: plan.updates.length,
      errors: plan.errors,
      createdIds: [],
    };
    if (result.dryRun) return result;

    const as: ActorContext = { ...actor, actorType: 'USER' };
    for (const update of plan.updates) {
      if (update.priceCents !== undefined || update.compareAtCents !== undefined) {
        await this.catalog.updateVariant(
          update.variantId,
          {
            ...(update.priceCents !== undefined ? { priceCents: update.priceCents } : {}),
            ...(update.compareAtCents !== undefined
              ? { compareAtCents: update.compareAtCents }
              : {}),
          },
          as,
        );
      }
      if (update.stockDelta !== 0) {
        await this.inventory.adjust(
          update.variantId,
          {
            delta: update.stockDelta,
            reason: update.stockDelta > 0 ? 'RECEIVED' : 'CORRECTION',
            note: 'CSV import',
          },
          as,
        );
      }
    }
    for (const create of plan.creates) {
      try {
        const detail = await this.catalog.createProduct(
          { ...create.product, status: 'DRAFT' },
          as,
          { sellerId: seller.id },
        );
        result.createdIds.push(detail.id);
      } catch (error) {
        // A SKU or barcode taken since the check: report it and carry on with the rest.
        result.errors.push({
          row: create.rows[0]!,
          message: isUniqueViolation(error)
            ? 'A SKU or barcode in this listing was just taken. Nothing was saved for it.'
            : (error as Error).message,
        });
      }
    }
    await this.audit.record({
      action: 'seller.listings.imported',
      actorType: 'USER',
      actorId: actor.user.id,
      entityType: 'seller',
      entityId: seller.id,
      meta: actor.meta,
      metadata: {
        rows: result.rows,
        created: result.createdIds.length,
        updatedOptions: result.updatedOptions,
      },
    });
    return result;
  }
}
