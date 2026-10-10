import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  parseSizeChart,
  type SizeChartSave,
  type SizeChartTable,
  type SizeChartView,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type ChartRow = Prisma.SizeChartGetPayload<{
  include: { category: { select: { name: true } }; _count: { select: { products: true } } };
}>;

const include = {
  category: { select: { name: true } },
  _count: { select: { products: true } },
} as const;

function toView(row: ChartRow): SizeChartView {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    nixzora: row.sellerId === null,
    isDefault: row.isDefault,
    productCount: row._count.products,
    columns: row.columns,
    rows: (row.rows as SizeChartTable['rows']) ?? [],
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Size charts (p10-26, ADR-0048). A store manages its own (`sellerId`); NIXZORA staff manage
 * NIXZORA's (`sellerId` null), one of which per category can be the default.
 */
@Injectable()
export class SizeChartsService {
  constructor(private readonly prisma: PrismaService) {}

  /** A store sees its own charts and NIXZORA's (which it may use too). */
  async list(sellerId: string | null): Promise<SizeChartView[]> {
    const rows = await this.prisma.sizeChart.findMany({
      where: sellerId ? { OR: [{ sellerId }, { sellerId: null }] } : { sellerId: null },
      include,
      orderBy: [{ sellerId: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
    });
    return rows.map(toView);
  }

  async create(sellerId: string | null, input: SizeChartSave): Promise<SizeChartView> {
    await this.requireCategory(input.categoryId);
    const table = this.table(input.text);
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault && sellerId === null) await this.clearDefault(tx, input.categoryId);
      return tx.sizeChart.create({
        data: {
          sellerId,
          categoryId: input.categoryId,
          name: input.name,
          note: input.note ?? null,
          columns: table.columns,
          rows: table.rows,
          isDefault: sellerId === null && Boolean(input.isDefault),
        },
        include,
      });
    });
    return toView(row);
  }

  async update(sellerId: string | null, id: string, input: SizeChartSave): Promise<SizeChartView> {
    await this.owned(sellerId, id);
    await this.requireCategory(input.categoryId);
    const table = this.table(input.text);
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault && sellerId === null) await this.clearDefault(tx, input.categoryId, id);
      return tx.sizeChart.update({
        where: { id },
        data: {
          categoryId: input.categoryId,
          name: input.name,
          note: input.note ?? null,
          columns: table.columns,
          rows: table.rows,
          ...(sellerId === null ? { isDefault: Boolean(input.isDefault) } : {}),
        },
        include,
      });
    });
    return toView(row);
  }

  /** Listings using it go back to their category's default chart. */
  async remove(sellerId: string | null, id: string): Promise<void> {
    await this.owned(sellerId, id);
    await this.prisma.sizeChart.delete({ where: { id } });
  }

  private table(text: string): SizeChartTable {
    const parsed = parseSizeChart(text);
    if (!parsed.ok) throw new BadRequestException('Check the size chart and try again.');
    return parsed.table;
  }

  private async owned(sellerId: string | null, id: string): Promise<void> {
    const row = await this.prisma.sizeChart.findUnique({
      where: { id },
      select: { sellerId: true },
    });
    if (!row || row.sellerId !== sellerId) throw new NotFoundException('Size chart not found.');
  }

  private async requireCategory(id: string): Promise<void> {
    if (!(await this.prisma.category.findUnique({ where: { id }, select: { id: true } }))) {
      throw new BadRequestException('Choose a category.');
    }
  }

  private async clearDefault(
    tx: Prisma.TransactionClient,
    categoryId: string,
    except?: string,
  ): Promise<void> {
    await tx.sizeChart.updateMany({
      where: {
        sellerId: null,
        categoryId,
        isDefault: true,
        ...(except ? { id: { not: except } } : {}),
      },
      data: { isDefault: false },
    });
  }
}
