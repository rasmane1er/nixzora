import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type Formatters, formatters, type Translate, translator } from '@nixzora/i18n';
import { toLocale } from '../../common/locale';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { PushService } from './push.service';

type Copy = (
  t: Translate<'email'>,
  money: Formatters['money'],
  number: string,
  payload: Record<string, unknown>,
) => { title: string; body: string };

/** Short, lock-screen-friendly copy for each order event, in the account's language. */
const COPY: Record<string, Copy> = {
  'order.paid': (t, _, number) => ({
    title: t('push_orderPaid_title'),
    body: t('push_orderPaid_body', { number }),
  }),
  'order.shipped': (t, _, number) => ({
    title: t('push_orderShipped_title'),
    body: t('push_orderShipped_body', { number }),
  }),
  'order.delivered': (t, _, number) => ({
    title: t('push_orderDelivered_title'),
    body: t('push_orderDelivered_body', { number }),
  }),
  'order.cancelled': (t, _, number) => ({
    title: t('push_orderCancelled_title'),
    body: t('push_orderCancelled_body', { number }),
  }),
  'order.refunded': (t, money, number, payload) => ({
    title: t('push_orderRefunded_title'),
    body:
      typeof payload.amountCents === 'number'
        ? t('push_orderRefunded_body', { number, amount: money(payload.amountCents) })
        : t('push_orderRefunded_bodyNoAmount', { number }),
  }),
  'return.approved': (t, _, number) => ({
    title: t('push_returnApproved_title'),
    body: t('push_returnApproved_body', { number }),
  }),
  'return.rejected': (t, _, number) => ({
    title: t('push_returnRejected_title'),
    body: t('push_returnRejected_body', { number }),
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
      select: { number: true, userId: true, kind: true, user: { select: { language: true } } },
    });
    if (!order?.userId || order.kind === 'PLUS') return;
    const locale = toLocale(order.user?.language);
    await this.push.sendToUser(order.userId, {
      ...copy(translator(locale)('email'), formatters(locale).money, order.number, payload),
      data: { path: `/orders/${order.number}`, orderNumber: order.number },
    });
  }
}
