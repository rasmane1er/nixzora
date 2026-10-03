import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { OutboxService } from '../outbox/outbox.service';
import { orderAccessToken, orderInclude, type OrderRow, toOrderView } from './order-links';

type Kind =
  | 'receipt'
  | 'shipped'
  | 'cancelled'
  | 'refunded'
  | 'delivered'
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected';

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

/** Customer emails driven by order events in the outbox (sent after the transaction commits). */
@Injectable()
export class OrderEmails implements OnModuleInit {
  constructor(
    private readonly outbox: OutboxService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    this.outbox.on('order.paid', ({ aggregateId }) => this.send(aggregateId, 'receipt'));
    this.outbox.on('order.shipped', ({ aggregateId }) => this.send(aggregateId, 'shipped'));
    this.outbox.on('order.cancelled', ({ aggregateId, payload }) =>
      this.send(aggregateId, 'cancelled', payload),
    );
    this.outbox.on('order.refunded', ({ aggregateId, payload }) =>
      this.send(aggregateId, 'refunded', payload),
    );
    this.outbox.on('order.delivered', ({ aggregateId }) => this.send(aggregateId, 'delivered'));
    for (const kind of ['requested', 'approved', 'rejected'] as const) {
      this.outbox.on(`return.${kind}`, ({ aggregateId, payload }) =>
        this.send(String(payload.orderId), `return_${kind}`, { returnId: aggregateId }),
      );
    }
  }

  private link(order: OrderRow): string {
    const base = this.config.get('WEB_APP_URL', { infer: true });
    const token = orderAccessToken(this.config.get('ORDER_LINK_SECRET', { infer: true }), order.id);
    return `${base}/orders/${order.number}?token=${token}`;
  }

  private async send(
    orderId: string,
    kind: Kind,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) return;
    const view = toOrderView(order);
    const link = this.link(order);
    const lines = view.items
      .map(
        (item) =>
          `  ${item.quantity} × ${item.productTitle} (${item.variantTitle}) — ${money(item.totalCents, view.currency)}`,
      )
      .join('\n');
    const totals = [
      `Subtotal: ${money(view.subtotalCents, view.currency)}`,
      `Shipping: ${view.shippingCents ? money(view.shippingCents, view.currency) : 'Free'}`,
      `Tax: ${money(view.taxCents, view.currency)}`,
      `Total: ${money(view.totalCents, view.currency)}`,
    ].join('\n');
    const a = view.shippingAddress;
    const address = [a.fullName, a.line1, a.line2, `${a.city}, ${a.region} ${a.postalCode}`]
      .filter(Boolean)
      .join('\n');

    // Marketplace orders arrive in several parcels, one per seller.
    const parcels = view.shipments.length
      ? view.shipments.filter((part) => part.tracking)
      : view.tracking
        ? [{ seller: null, tracking: view.tracking }]
        : [];
    const trackingText = parcels
      .map(
        (part) =>
          `${part.seller ? `From ${part.seller.displayName}: ` : view.shipments.length ? 'From NIXZORA: ' : ''}${part.tracking!.carrier} tracking number ${part.tracking!.number}\n${part.tracking!.url ?? ''}\n\n`,
      )
      .join('');

    const content = {
      receipt: {
        subject: `Your NIXZORA order ${view.number}`,
        text: `Thanks for your order!\n\nOrder ${view.number}\n\n${lines}\n\n${totals}\n\nShipping to:\n${address}\n\nTrack your order: ${link}\n`,
      },
      shipped: {
        subject: `Your order ${view.number} is on its way`,
        text: `Good news: order ${view.number} has shipped.\n\n${trackingText}Order details: ${link}\n`,
      },
      cancelled: {
        subject: `Your order ${view.number} was cancelled`,
        text: `Order ${view.number} was cancelled and ${money(Number(payload.amountCents ?? view.totalCents), view.currency)} has been refunded to your original payment method. Refunds usually appear within 5–10 business days.\n\nOrder details: ${link}\n`,
      },
      refunded: {
        subject: `A refund for order ${view.number}`,
        text: `We refunded ${money(Number(payload.amountCents ?? 0), view.currency)} for order ${view.number} (${String(payload.reason ?? 'refund')}). It usually appears on your statement within 5–10 business days.\n\nOrder details: ${link}\n`,
      },
      delivered: {
        subject: `Delivered: order ${view.number}`,
        text: `Your order ${view.number} was delivered. Enjoy it!\n\nSomething not right? You can start a return within 30 days from your order page: ${link}\n\nWe'd love a review once you've tried it.\n`,
      },
      return_requested: {
        subject: `We received your return request for ${view.number}`,
        text: `Thanks — we got your return request for order ${view.number}. We'll review it within one business day and email you the next steps.\n\nOrder details: ${link}\n`,
      },
      return_approved: {
        subject: `Your return for ${view.number} is approved`,
        text: `Your return for order ${view.number} is approved. Pack the items securely and send them to:\n\nNIXZORA Returns\n100 Warehouse Way\nUpper Marlboro, MD 20774\n\nWrite ${view.number} on the box. We refund you as soon as it arrives.\n\nOrder details: ${link}\n`,
      },
      return_rejected: {
        subject: `About your return for ${view.number}`,
        text: `We couldn't accept the return request for order ${view.number}. Reply to this email if you have questions — we're happy to help.\n\nOrder details: ${link}\n`,
      },
    }[kind];

    await this.mail.send({
      to: view.email,
      subject: content.subject,
      text: content.text,
      template: `orders.${kind}`,
      data: { number: view.number, link },
    });
  }
}
