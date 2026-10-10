import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatters, type Locale, translator } from '@nixzora/i18n';
import { toLocale } from '../../common/locale';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { type EmailBlock, renderEmail } from '../notifications/email-layout';
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

  /**
   * The customer's language: the account's current choice, or for a guest the language they
   * checked out in (orders.language, from Accept-Language at checkout).
   */
  private async locale(order: OrderRow): Promise<Locale> {
    if (order.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: order.userId },
        select: { language: true },
      });
      if (user) return toLocale(user.language);
    }
    return toLocale(order.language);
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
    // A Plus fee (p10-15) gets the membership's own emails instead.
    if (order.kind === 'PLUS') return;
    const view = toOrderView(order);
    const link = this.link(order);
    const locale = await this.locale(order);
    const t = translator(locale)('email');
    const { money } = formatters(locale);
    const lines = view.items
      .map((item) =>
        t('order_line', {
          quantity: item.quantity,
          product: item.productTitle,
          variant: item.variantTitle,
          amount: money(item.totalCents, view.currency),
        }),
      )
      .join('\n');
    const totals = [
      t('order_subtotal', { amount: money(view.subtotalCents, view.currency) }),
      t('order_shipping', {
        amount: view.shippingCents
          ? money(view.shippingCents, view.currency)
          : t('order_shippingFree'),
      }),
      t('order_tax', { amount: money(view.taxCents, view.currency) }),
      t('order_total', { amount: money(view.totalCents, view.currency) }),
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
      .map((part) => {
        const from = part.seller
          ? t('order_parcelFrom', { seller: part.seller.displayName })
          : view.shipments.length
            ? t('order_parcelFrom', { seller: 'NIXZORA' })
            : '';
        const number = t('order_trackingNumber', {
          carrier: part.tracking!.carrier,
          number: part.tracking!.number,
        });
        return `${from}${number}\n${part.tracking!.url ?? ''}\n\n`;
      })
      .join('');

    const vars = { number: view.number, link };
    const content = {
      receipt: {
        subject: t('order_receipt_subject', vars),
        text: t('order_receipt_text', { ...vars, lines, totals, address }),
      },
      shipped: {
        subject: t('order_shipped_subject', vars),
        text: t('order_shipped_text', { ...vars, tracking: trackingText }),
      },
      cancelled: {
        subject: t('order_cancelled_subject', vars),
        text: t('order_cancelled_text', {
          ...vars,
          amount: money(Number(payload.amountCents ?? view.totalCents), view.currency),
        }),
      },
      refunded: {
        subject: t('order_refunded_subject', vars),
        text: t('order_refunded_text', {
          ...vars,
          amount: money(Number(payload.amountCents ?? 0), view.currency),
          reason:
            payload.reason === undefined || payload.reason === null
              ? t('order_refundDefaultReason')
              : String(payload.reason),
        }),
      },
      delivered: {
        subject: t('order_delivered_subject', vars),
        text: t('order_delivered_text', vars),
      },
      return_requested: {
        subject: t('order_returnRequested_subject', vars),
        text: t('order_returnRequested_text', vars),
      },
      return_approved: {
        subject: t('order_returnApproved_subject', vars),
        text: t('order_returnApproved_text', vars),
      },
      return_rejected: {
        subject: t('order_returnRejected_subject', vars),
        text: t('order_returnRejected_text', vars),
      },
    }[kind];

    // HTML version: the same words, laid out. Receipts get the item table and totals; the
    // others reuse their text paragraphs, with the order link as a button.
    const detailsLine = t('order_details', { link }).trim();
    const paragraphs = content.text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p && p !== detailsLine)
      // The button below links to the order, so drop the raw URL from sentences that end with it.
      .map((p) => (p.endsWith(link) ? p.slice(0, -link.length).replace(/[\s:]+$/, '.') : p));
    const blocks: EmailBlock[] =
      kind === 'receipt'
        ? [
            { kind: 'text', paragraphs: [t('order_html_thanks')] },
            {
              kind: 'items',
              title: t('order_html_items'),
              items: view.items.map((item) => ({
                name: item.productTitle,
                detail: t('order_html_itemDetail', {
                  quantity: item.quantity,
                  variant: item.variantTitle,
                }),
                amount: money(item.totalCents, view.currency),
              })),
            },
            {
              kind: 'rows',
              rows: [
                {
                  label: t('order_html_subtotal'),
                  value: money(view.subtotalCents, view.currency),
                },
                {
                  label: t('order_html_shipping'),
                  value: view.shippingCents
                    ? money(view.shippingCents, view.currency)
                    : t('order_shippingFree'),
                },
                { label: t('order_html_tax'), value: money(view.taxCents, view.currency) },
                {
                  label: t('order_html_total'),
                  value: money(view.totalCents, view.currency),
                  strong: true,
                },
              ],
            },
            { kind: 'box', title: t('order_html_shipTo'), lines: address.split('\n') },
          ]
        : [
            {
              kind: 'text',
              paragraphs:
                kind === 'shipped'
                  ? paragraphs.filter((p) => !trackingText.includes(p))
                  : paragraphs,
            },
            ...(kind === 'shipped' && parcels.length
              ? [
                  {
                    kind: 'links' as const,
                    links: parcels.map((part) => ({
                      label: [
                        part.seller
                          ? t('order_parcelFrom', { seller: part.seller.displayName })
                          : '',
                        t('order_trackingNumber', {
                          carrier: part.tracking!.carrier,
                          number: part.tracking!.number,
                        }),
                      ].join(''),
                      url: part.tracking!.url ?? null,
                      linkText: t('order_html_track'),
                    })),
                  },
                ]
              : []),
          ];
    const html = renderEmail({
      lang: locale,
      preheader: kind === 'receipt' ? t('order_html_thanks') : (paragraphs[0] ?? content.subject),
      heading: content.subject,
      blocks,
      button: { label: t('order_html_viewOrder'), url: link },
      footer: [t('order_html_footer'), 'NIXZORA · 100 Warehouse Way, Upper Marlboro, MD 20774'],
    });

    await this.mail.send({
      to: view.email,
      subject: content.subject,
      text: content.text,
      html,
      template: `orders.${kind}`,
      data: { number: view.number, link },
    });
  }
}
