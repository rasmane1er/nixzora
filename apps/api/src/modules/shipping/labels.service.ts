import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Address, type LabelPurchase, type OrderView } from '@nixzora/validation';
import { type Env } from '../../config/env';
import { type RequestMeta } from '../../common/request-meta';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../identity/auth-user';
import { markPartsDelivered, settleShipment, verifySellerShipment } from '../orders/marketplace';
import { orderInclude, toOrderView } from '../orders/order-links';
import {
  type ShipAddress,
  SHIPPING_GATEWAY,
  type ShippingGateway,
  type TrackingEvent,
} from './shipping-gateway';

/** Buying postage for paid orders, and following carrier tracking to "delivered". */
@Injectable()
export class LabelsService {
  private readonly logger = new Logger(LabelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
    @Inject(SHIPPING_GATEWAY) readonly gateway: ShippingGateway,
  ) {}

  from(): ShipAddress {
    const get = <K extends keyof Env>(key: K) => this.config.get(key, { infer: true });
    return {
      name: get('SHIP_FROM_NAME'),
      street1: get('SHIP_FROM_STREET'),
      city: get('SHIP_FROM_CITY'),
      state: get('SHIP_FROM_STATE'),
      zip: get('SHIP_FROM_ZIP'),
      country: 'US',
      phone: get('SHIP_FROM_PHONE'),
    };
  }

  async buy(
    orderId: string,
    parcel: LabelPurchase,
    actor: { user: AuthUser; meta: RequestMeta },
  ): Promise<OrderView> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.status !== 'PAID' && order.status !== 'FULFILLING') {
      throw new ConflictException('Labels can be bought for paid orders that have not shipped.');
    }
    if (order.items.every((item) => item.sellerId)) {
      throw new ConflictException('Every item in this order ships from its seller.');
    }
    if (order.trackingNumber) {
      throw new ConflictException("NIXZORA's items in this order have already shipped.");
    }
    const to = order.shippingAddress as Address;
    const label = await this.gateway.buyLabel({
      reference: order.number,
      from: this.from(),
      to: {
        name: to.fullName,
        street1: to.line1,
        street2: to.line2,
        city: to.city,
        state: to.region,
        zip: to.postalCode,
        country: 'US',
        phone: to.phone,
        email: order.email,
      },
      parcel,
    });

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (order.items.some((item) => item.sellerId)) {
        // Marketplace order: the label covers NIXZORA's own items; sellers ship theirs.
        await settleShipment(tx, orderId, {
          carrier: label.carrier,
          trackingNumber: label.trackingNumber,
          labelUrl: label.labelUrl,
          postageCents: label.postageCents,
        });
        return true;
      }
      const result = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['PAID', 'FULFILLING'] } },
        data: {
          status: 'SHIPPED',
          shippedAt: now,
          fulfillingAt: order.fulfillingAt ?? now,
          trackingCarrier: label.carrier,
          trackingNumber: label.trackingNumber,
          labelUrl: label.labelUrl,
          postageCents: label.postageCents,
        },
      });
      if (result.count) {
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'order',
            aggregateId: orderId,
            type: 'order.shipped',
            payload: { number: order.number },
          },
        });
      }
      return result.count > 0;
    });
    if (!updated) {
      // Someone shipped it meanwhile; the bought label must be voided by hand.
      this.logger.error(
        `Label ${label.trackingNumber} bought for ${order.number}, which was already shipped.`,
      );
      throw new ConflictException(
        'This order was shipped by someone else meanwhile. Void the extra label in the carrier dashboard.',
      );
    }
    await this.audit.record({
      action: 'orders.label.purchased',
      actorId: actor.user.id,
      entityType: 'order',
      entityId: orderId,
      meta: actor.meta,
      metadata: { number: order.number, carrier: label.carrier, postageCents: label.postageCents },
    });
    const fresh = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });
    return toOrderView(fresh);
  }

  /** Carrier says delivered → the order is delivered (and its return window starts). */
  async applyTracking(event: TrackingEvent): Promise<'applied' | 'duplicate' | 'ignored'> {
    const first = await this.redis.client
      .set(`webhook:shipping:${event.id}`, '1', 'EX', 7 * 86_400, 'NX')
      .catch(() => 'OK');
    if (first !== 'OK') return 'duplicate';
    if (event.status === 'other') return 'ignored';
    // A seller's own shipment: the first scan releases its earnings to the normal hold (p9-05).
    const sellerShipments = await this.prisma.$transaction((tx) =>
      verifySellerShipment(tx, event.trackingNumber, event.status === 'delivered'),
    );
    if (event.status !== 'delivered') return sellerShipments ? 'applied' : 'ignored';
    const order = await this.prisma.order.findFirst({
      where: { trackingNumber: event.trackingNumber },
    });
    if (!order) return sellerShipments ? 'applied' : 'ignored';
    const done = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: order.id, status: 'SHIPPED' },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
      if (result.count) await markPartsDelivered(tx, order.id);
      if (result.count) {
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'order',
            aggregateId: order.id,
            type: 'order.delivered',
            payload: { number: order.number },
          },
        });
      }
      return result.count > 0;
    });
    return done ? 'applied' : 'ignored';
  }
}
