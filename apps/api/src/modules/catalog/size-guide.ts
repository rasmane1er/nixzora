import { FIT_MIN_ANSWERS, type FitAnswer, type ProductSizeGuide } from '@nixzora/validation';
import { type PrismaService } from '../../prisma/prisma.service';

/** Departments whose products are sized (p10-26): clothing and shoes. */
export const SIZED_DEPARTMENTS = new Set(['clothing-shoes']);

type ChartRow = { name: string; note: string | null; columns: string[]; rows: unknown };

function table(chart: ChartRow): NonNullable<ProductSizeGuide['chart']> {
  const rows = Array.isArray(chart.rows)
    ? (chart.rows as { size: string; values: string[] }[])
    : [];
  return { name: chart.name, note: chart.note, columns: chart.columns, rows };
}

/**
 * A sized product's guide: its own chart, else NIXZORA's default for its category or the nearest
 * parent category; and how reviewers said it fit. `categoryIds` is the product's category first,
 * then its parents.
 */
export async function sizeGuideFor(
  prisma: Pick<PrismaService, 'sizeChart' | 'review'>,
  product: { id: string; sizeChartId: string | null },
  categoryIds: string[],
): Promise<ProductSizeGuide> {
  const own = product.sizeChartId
    ? await prisma.sizeChart.findUnique({ where: { id: product.sizeChartId } })
    : null;
  let chart = own;
  if (!chart && categoryIds.length) {
    const defaults = await prisma.sizeChart.findMany({
      where: { sellerId: null, isDefault: true, categoryId: { in: categoryIds } },
    });
    chart =
      categoryIds.map((id) => defaults.find((d) => d.categoryId === id)).find(Boolean) ?? null;
  }
  const counts = await prisma.review.groupBy({
    by: ['fit'],
    where: { productId: product.id, status: 'APPROVED', fit: { not: null } },
    _count: { _all: true },
  });
  const of = (fit: FitAnswer) => counts.find((c) => c.fit === fit)?._count._all ?? 0;
  const small = of('SMALL');
  const trueToSize = of('TRUE');
  const large = of('LARGE');
  const answers = small + trueToSize + large;
  const top = (
    [
      ['SMALL', small],
      ['TRUE', trueToSize],
      ['LARGE', large],
    ] as [FitAnswer, number][]
  ).sort((a, b) => b[1] - a[1])[0]!;
  return {
    chart: chart ? table(chart) : null,
    fit: {
      answers,
      small,
      trueToSize,
      large,
      // A verdict needs enough answers and at least half of them agreeing.
      verdict: answers >= FIT_MIN_ANSWERS && top[1] * 2 >= answers ? top[0] : null,
    },
  };
}
