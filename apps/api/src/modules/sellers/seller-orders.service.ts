import {
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type Address,
  type PagedResult,
  type SellerBalance,
  type SellerLedgerEntryView,
  type SellerOrderListQuery,
  type SellerOrderShip,
  type SellerOrderView,
} from '@nixzora/validation';
import { type Env } from '../../config/env';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { MailService } from '../notifications/mail.service';
import { settleShipment } from '../orders/marketplace';
import { TRACKING_URLS } from '../orders/order-links';
import { OutboxService } from '../outbox/outbox.service';
import { SellersService } from './sellers.service';

const DAY = 86_400_000;

const include = {
  order: {
    select: {
      number: true,
      currency: true,
      placedAt: true,
      shippingAddress: true,
      items: true,
    },
  },
} satisfies Prisma.SellerOrderInclude;
type Row = Prisma.SellerOrderGetPayload<{ include: typeof include }>;

const money = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

/**
 * A seller's side of marketplace orders (p7-04, p7-05): what to ship, shipping it, and what it
 * earns. Shipping credits the earnings ledger, available after the store's hold period.
 */
@Injectable()
export class SellerOrdersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sellers: SellersService,
    private readonly outbox: OutboxService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    this.outbox.on('seller.order.created', ({ aggregateId }) => this.notifyNewOrder(aggregateId));
  }

  async list(
    query: SellerOrderListQuery,
    actor: ActorContext,
  ): Promise<PagedResult<SellerOrderView>> {
    const { seller } = await this.sellers.require(actor.user.id);
    const where = { sellerId: seller.id, ...(query.status ? { status: query.status } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.sellerOrder.count({ where }),
      this.prisma.sellerOrder.findMany({
        where,
        include,
        // Orders waiting to ship first, oldest first; then the rest, newest first.
        orderBy: [{ status: 'asc' }, { createdAt: query.status === 'PAID' ? 'asc' : 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => this.view(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async get(id: string, actor: ActorContext): Promise<SellerOrderView> {
    return this.view(await this.owned(id, actor));
  }

  async ship(id: string, input: SellerOrderShip, actor: ActorContext): Promise<SellerOrderView> {
    const { seller } = await this.sellers.require(actor.user.id, { write: true });
    const part = await this.owned(id, actor);
    if (part.status !== 'PAID') {
      throw new ConflictException(
        part.status === 'CANCELLED' ? 'This order was cancelled.' : 'Already shipped.',
      );
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.sellerOrder.updateMany({
        where: { id, status: 'PAID' },
        data: {
          status: 'SHIPPED',
          shippedAt: now,
          trackingCarrier: input.carrier,
          trackingNumber: input.trackingNumber.toUpperCase(),
        },
      });
      if (!updated.count) throw new ConflictException('Already shipped.');
      await tx.sellerLedgerEntry.create({
        data: {
          sellerId: part.sellerId,
          sellerOrderId: id,
          type: 'SALE',
          amountCents: part.netCents,
          availableAt: new Date(now.getTime() + seller.payoutHoldDays * DAY),
          description: `Order ${part.order.number}`,
          idempotencyKey: `sale:${id}`,
        },
      });
      await settleShipment(tx, part.orderId);
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'seller_order',
          aggregateId: id,
          type: 'seller.order.shipped',
          payload: { sellerId: part.sellerId, orderId: part.orderId, carrier: input.carrier },
        },
      });
    });
    await this.audit.record({
      action: 'seller.order.shipped',
      actorType: 'USER',
      actorId: actor.user.id,
      entityType: 'seller_order',
      entityId: id,
      meta: actor.meta,
      metadata: { orderNumber: part.order.number, carrier: input.carrier },
    });
    return this.get(id, actor);
  }

  async balanceFor(actor: ActorContext): Promise<SellerBalance> {
    const { seller } = await this.sellers.require(actor.user.id);
    return this.balance(seller.id);
  }

  async balance(sellerId: string): Promise<SellerBalance> {
    const now = new Date();
    const [pending, held, available, lifetime, next] = await Promise.all([
      this.prisma.sellerOrder.aggregate({
        where: { sellerId, status: 'PAID' },
        _sum: { netCents: true },
      }),
      this.prisma.sellerLedgerEntry.aggregate({
        where: { sellerId, availableAt: { gt: now } },
        _sum: { amountCents: true },
      }),
      this.prisma.sellerLedgerEntry.aggregate({
        where: { sellerId, availableAt: { lte: now } },
        _sum: { amountCents: true },
      }),
      this.prisma.sellerLedgerEntry.aggregate({
        where: { sellerId, type: { in: ['SALE', 'REFUND', 'ADJUSTMENT'] } },
        _sum: { amountCents: true },
      }),
      this.prisma.sellerLedgerEntry.findFirst({
        where: { sellerId, availableAt: { gt: now }, amountCents: { gt: 0 } },
        orderBy: { availableAt: 'asc' },
        select: { availableAt: true },
      }),
    ]);
    return {
      currency: 'USD',
      pendingCents: pending._sum.netCents ?? 0,
      onHoldCents: held._sum.amountCents ?? 0,
      availableCents: available._sum.amountCents ?? 0,
      lifetimeNetCents: lifetime._sum.amountCents ?? 0,
      nextReleaseAt: next?.availableAt.toISOString() ?? null,
    };
  }

  async ledger(
    actor: ActorContext,
    page = 1,
    pageSize = 50,
  ): Promise<PagedResult<SellerLedgerEntryView>> {
    const { seller } = await this.sellers.require(actor.user.id);
    const where = { sellerId: seller.id };
    const [total, rows] = await Promise.all([
      this.prisma.sellerLedgerEntry.count({ where }),
      this.prisma.sellerLedgerEntry.findMany({
        where,
        include: { sellerOrder: { select: { order: { select: { number: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        amountCents: row.amountCents,
        description: row.description,
        orderNumber: row.sellerOrder?.order.number ?? null,
        availableAt: row.availableAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // ───────────── Helpers ─────────────

  private async owned(id: string, actor: ActorContext): Promise<Row> {
    const { seller } = await this.sellers.require(actor.user.id);
    const row = await this.prisma.sellerOrder.findFirst({
      where: { id, sellerId: seller.id },
      include,
    });
    if (!row) throw new NotFoundException('Order not found.');
    return row;
  }

  private view(row: Row): SellerOrderView {
    const address = row.order.shippingAddress as Address;
    return {
      id: row.id,
      orderNumber: row.order.number,
      status: row.status,
      currency: row.order.currency,
      placedAt: row.order.placedAt?.toISOString() ?? null,
      items: row.order.items
        .filter((item) => item.sellerId === row.sellerId)
        .map((item) => ({
          id: item.id,
          productTitle: item.productTitle,
          variantTitle: item.variantTitle,
          sku: item.sku,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents,
        })),
      itemsCents: row.itemsCents,
      shippingCents: row.shippingCents,
      commissionBps: row.commissionBps,
      commissionCents: row.commissionCents,
      netCents: row.netCents,
      refundedCents: row.refundedCents,
      shipTo: {
        fullName: address.fullName,
        line1: address.line1,
        line2: address.line2 ?? null,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        country: address.country,
      },
      tracking:
        row.trackingCarrier && row.trackingNumber
          ? {
              carrier: row.trackingCarrier,
              number: row.trackingNumber,
              url: TRACKING_URLS[row.trackingCarrier]?.(row.trackingNumber) ?? null,
            }
          : null,
      shippedAt: row.shippedAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
    };
  }

  /** Emails the store: a new order to ship. */
  private async notifyNewOrder(sellerOrderId: string): Promise<void> {
    const row = await this.prisma.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      include: { ...include, seller: { select: { contactEmail: true, displayName: true } } },
    });
    if (!row) return;
    const view = this.view(row);
    const link = `${this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '')}/sell/orders/${row.id}`;
    const lines = view.items
      .map(
        (item) =>
          `  ${item.quantity} × ${item.productTitle} (${item.variantTitle}), SKU ${item.sku}`,
      )
      .join('\n');
    await this.mail.trySend({
      to: row.seller.contactEmail,
      subject: `New order ${view.orderNumber}: ship within 2 business days`,
      text: `${row.seller.displayName} has a new order.\n\nOrder ${view.orderNumber}\n${lines}\n\nYou earn ${money(view.netCents, view.currency)} after the ${row.commissionBps / 100}% commission.\n\nShip it and add the tracking number here: ${link}\n`,
      template: 'sellers.new-order',
      data: { number: view.orderNumber, link },
    });
  }
}
