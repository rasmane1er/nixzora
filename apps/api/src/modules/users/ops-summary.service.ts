import { Injectable } from '@nestjs/common';
import { LOW_STOCK_THRESHOLD } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

/** Numbers for the Ops Center home screen. */
@Injectable()
export class OpsSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async summary() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
    const [products, customers, staff, lowStock, lowStockCount, recent, toShip, sales] =
      await Promise.all([
        this.prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.user.count({ where: { roles: { some: { role: { key: 'customer' } } } } }),
        this.prisma.user.count({
          where: { roles: { some: { role: { key: { not: 'customer' } } } } },
        }),
        this.inventory.list({ lowStockThreshold: LOW_STOCK_THRESHOLD }),
        this.inventory.countLowStock(LOW_STOCK_THRESHOLD),
        this.prisma.auditLog.findMany({ orderBy: { id: 'desc' }, take: 8 }),
        this.prisma.order.count({ where: { status: { in: ['PAID', 'FULFILLING'] } } }),
        this.prisma.order.aggregate({
          where: {
            placedAt: { gte: weekAgo },
            status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
          },
          _sum: { totalCents: true },
          _count: { _all: true },
        }),
      ]);
    return {
      products: Object.fromEntries(products.map((row) => [row.status, row._count._all])),
      customers,
      staff,
      lowStockCount,
      ordersToShip: toShip,
      salesLast7Days: { cents: sales._sum.totalCents ?? 0, orders: sales._count._all },
      lowStock: lowStock.slice(0, 5),
      recentActivity: recent.map((row) => ({
        id: row.id.toString(),
        action: row.action,
        actorId: row.actorId,
        entityType: row.entityType,
        entityId: row.entityId,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
