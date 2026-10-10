import { type TrafficSource } from '@nixzora/validation';
import { type PrismaService } from '../../prisma/prisma.service';

/**
 * Store analytics counters (p10-25, ADR-0047): one row per product, US Eastern day and source,
 * incremented in place. No shopper is stored, so these count everyone. Best-effort: a failed
 * count never fails the page view or the add to cart.
 */
export async function countView(
  prisma: PrismaService,
  productId: string,
  source: TrafficSource,
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO product_view_sources (product_id, day, source, views)
    VALUES (${productId}::uuid, (timezone('America/New_York', now()))::date, ${source}, 1)
    ON CONFLICT (product_id, day, source) DO UPDATE SET views = product_view_sources.views + 1`
    .then(() => undefined)
    .catch(() => undefined);
}

export async function countCartAdd(prisma: PrismaService, productId: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO product_cart_adds (product_id, day, adds)
    VALUES (${productId}::uuid, (timezone('America/New_York', now()))::date, 1)
    ON CONFLICT (product_id, day) DO UPDATE SET adds = product_cart_adds.adds + 1`
    .then(() => undefined)
    .catch(() => undefined);
}
