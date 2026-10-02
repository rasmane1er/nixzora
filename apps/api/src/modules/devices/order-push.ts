import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { PushService } from './push.service';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

type Copy = (number: string, payload: Record<string, unknown>) => { title: string; body: string };

/** Short, lock-screen-friendly copy for each order event. */
const COPY: Record<string, Copy> = {
  'order.paid': (n) => ({ title: 'Order confirmed', body: `We have your order ${n}.` }),
  'order.shipped': (n) => ({ title: 'On its way', body: `Order ${n} has shipped.` }),
  'order.delivered': (n) => ({ title: 'Delivered', body: `Order ${n} was delivered.` }),
  'order.cancelled': (n) => ({
    title: 'Order cancelled',
    body: `Order ${n} was cancelled and refunded.`,
  }),
  'order.refunded': (n, payload) => ({
    title: 'Refund issued',
    body:
      typeof payload.amountCents === 'number'
        ? `We refunded ${money(payload.amountCents)} for order ${n}.`
        : `We issued a refund for order ${n}.`,
  }),
  'return.approved': (n) => ({
    title: 'Return approved',
    body: `Your return for order ${n} was approved.`,
  }),
  'return.rejected': (n) => ({
    title: 'Return update',
    body: `We could not accept the return for order ${n}.`,
  }),
};

/**
 * Sends a push to the customer's phones when their order changes. Guest orders have no account
 * and therefore no devices; they keep getting email only.
 */
@Injectable()
export class OrderPush implements OnModuleInit {
  constructor(
    private readonly outbox: OutboxService,
    private readonly push: PushService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    for (const [type, copy] of Object.entries(COPY)) {
      this.outbox.on(type, async ({ aggregateId, payload }) => {
        const orderId = type.startsWith('return.') ? String(payload.orderId) : aggregateId;
        await this.notify(orderId, copy, payload);
      });
    }
  }

  private async notify(
    orderId: string,
    copy: Copy,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { number: true, userId: true },
    });
    if (!order?.userId) return;
    await this.push.sendToUser(order.userId, {
      ...copy(order.number, payload),
      data: { path: `/orders/${order.number}`, orderNumber: order.number },
    });
  }
}
