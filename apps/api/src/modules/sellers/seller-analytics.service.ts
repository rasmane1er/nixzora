import { Injectable } from '@nestjs/common';
import { type SellerAnalytics, type SellerAnalyticsTotals } from '@nixzora/validation';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { SellersService } from './sellers.service';

/** Days are counted in US Eastern time, where NIXZORA and its first sellers operate. */
const TIME_ZONE = 'America/New_York';
const DAY = 86_400_000;

/**
 * Seller analytics (p7-08): sales, orders, earnings, product views and conversion for the
 * caller's store, with the previous period for comparison. Read-only SQL over seller orders,
 * order lines and product view events.
 */
@Injectable()
export class SellerAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellers: SellersService,
  ) {}

  async forSeller(days: number, actor: ActorContext): Promise<SellerAnalytics> {
    const { seller } = await this.sellers.require(actor.user.id);
    return this.build(seller.id, days);
  }

  async build(sellerId: string, days: number, now = new Date()): Promise<SellerAnalytics> {
    const from = new Date(now.getTime() - days * DAY);
    const before = new Date(from.getTime() - days * DAY);
    const [totals, previous, daily, topProducts] = await Promise.all([
      this.totals(sellerId, from, now),
      this.totals(sellerId, before, from),
      this.daily(sellerId, days, now),
      this.topProducts(sellerId, from, now),
    ]);
    return { days, currency: 'USD', timeZone: TIME_ZONE, totals, previous, daily, topProducts };
  }

  private async totals(sellerId: string, from: Date, to: Date): Promise<SellerAnalyticsTotals> {
    const [orders] = await this.prisma.$queryRaw<
      { sales: bigint; orders: bigint; net: bigint; refunded: bigint; units: bigint }[]
    >`
      SELECT coalesce(sum(so.items_cents), 0)::bigint AS sales,
             count(*)::bigint AS orders,
             coalesce(sum(so.net_cents), 0)::bigint AS net,
             coalesce(sum(so.refunded_cents), 0)::bigint AS refunded,
             coalesce(sum((SELECT sum(oi.quantity) FROM order_items oi
                           WHERE oi.order_id = so.order_id AND oi.seller_id = so.seller_id)), 0)::bigint AS units
      FROM seller_orders so
      WHERE so.seller_id = ${sellerId}::uuid
        AND so.status <> 'CANCELLED'
        AND so.created_at >= ${from} AND so.created_at < ${to}`;
    const [views] = await this.prisma.$queryRaw<{ views: bigint }[]>`
      SELECT count(*)::bigint AS views
      FROM product_events e JOIN products p ON p.id = e.product_id
      WHERE p.seller_id = ${sellerId}::uuid AND e.type = 'VIEW'
        AND e.created_at >= ${from} AND e.created_at < ${to}`;
    const viewCount = Number(views?.views ?? 0);
    const orderCount = Number(orders?.orders ?? 0);
    return {
      salesCents: Number(orders?.sales ?? 0),
      orders: orderCount,
      units: Number(orders?.units ?? 0),
      netCents: Number(orders?.net ?? 0),
      refundedCents: Number(orders?.refunded ?? 0),
      views: viewCount,
      conversionPct: viewCount ? Math.round((orderCount / viewCount) * 1000) / 10 : null,
    };
  }

  /** One row per day, including days without sales, oldest first. */
  private async daily(sellerId: string, days: number, now: Date) {
    const rows = await this.prisma.$queryRaw<{ day: string; sales: bigint; orders: bigint }[]>`
      WITH days AS (
        SELECT generate_series(
          (timezone(${TIME_ZONE}, ${now}::timestamptz))::date - (${days}::int - 1),
          (timezone(${TIME_ZONE}, ${now}::timestamptz))::date,
          interval '1 day'
        )::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             coalesce(sum(so.items_cents), 0)::bigint AS sales,
             count(so.id)::bigint AS orders
      FROM days d
      LEFT JOIN seller_orders so
        ON so.seller_id = ${sellerId}::uuid
       AND so.status <> 'CANCELLED'
       AND (timezone(${TIME_ZONE}, so.created_at AT TIME ZONE 'UTC'))::date = d.day
      GROUP BY d.day
      ORDER BY d.day`;
    return rows.map((row) => ({
      date: row.day,
      salesCents: Number(row.sales),
      orders: Number(row.orders),
    }));
  }

  /** The store's five best sellers in the period (then most viewed), with views. */
  private async topProducts(sellerId: string, from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      { id: string; title: string; units: bigint; sales: bigint; views: bigint }[]
    >(Prisma.sql`
      SELECT p.id::text AS id, p.title,
             coalesce(s.units, 0)::bigint AS units,
             coalesce(s.sales, 0)::bigint AS sales,
             coalesce(v.views, 0)::bigint AS views
      FROM products p
      LEFT JOIN (
        SELECT pv.product_id, sum(oi.quantity) AS units, sum(oi.total_cents) AS sales
        FROM order_items oi
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN seller_orders so ON so.order_id = oi.order_id AND so.seller_id = oi.seller_id
        WHERE oi.seller_id = ${sellerId}::uuid AND so.status <> 'CANCELLED'
          AND so.created_at >= ${from} AND so.created_at < ${to}
        GROUP BY pv.product_id
      ) s ON s.product_id = p.id
      LEFT JOIN (
        SELECT product_id, count(*) AS views
        FROM product_events
        WHERE type = 'VIEW' AND created_at >= ${from} AND created_at < ${to}
        GROUP BY product_id
      ) v ON v.product_id = p.id
      WHERE p.seller_id = ${sellerId}::uuid
        AND (s.units IS NOT NULL OR v.views IS NOT NULL)
      ORDER BY sales DESC, views DESC, p.title
      LIMIT 5`);
    return rows.map((row) => ({
      productId: row.id,
      title: row.title,
      units: Number(row.units),
      salesCents: Number(row.sales),
      views: Number(row.views),
    }));
  }
}
