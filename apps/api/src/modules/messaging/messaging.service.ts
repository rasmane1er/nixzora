import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { translator } from '@nixzora/i18n';
import {
  type AdminConversationView,
  type ConversationStart,
  type ConversationSummary,
  type ConversationView,
  type MessageAuthor,
} from '@nixzora/validation';
import { toLocale } from '../../common/locale';
import { type Env } from '../../config/env';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PushService } from '../devices/push.service';
import { authorName } from '../engagement/reviews.service';
import { StorageService } from '../media/storage.service';
import { MailService } from '../notifications/mail.service';

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
/** 10 or more digits, with the usual separators: a phone number. */
const PHONE = /\+?\d[\d\s().-]{8,}\d/g;

/**
 * Takes email addresses and phone numbers out of a message, so buying and talking stay on
 * NIXZORA (where we can help if something goes wrong). Returns the text and whether it changed.
 */
export function redactContacts(text: string): { body: string; redacted: boolean } {
  let redacted = false;
  const body = text
    .replace(EMAIL, () => {
      redacted = true;
      return '[removed]';
    })
    .replace(PHONE, (match) => {
      if (match.replace(/\D/g, '').length < 10) return match;
      redacted = true;
      return '[removed]';
    });
  return { body, redacted };
}

const include = {
  seller: { select: { id: true, handle: true, displayName: true, contactEmail: true } },
  customer: {
    select: { id: true, email: true, firstName: true, lastName: true, language: true },
  },
  messages: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ConversationInclude;
type Row = Prisma.ConversationGetPayload<{ include: typeof include }>;

type Side = 'customer' | 'seller';

/**
 * Customer ↔ store messages (p10-12). A customer writes to a store about a product or an order;
 * the store answers from the seller portal. Nobody's email is shown, contact details typed into
 * messages are removed, either side can report a thread, and staff can hide it.
 */
@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ───── Customers ─────

  async start(customerId: string, input: ConversationStart): Promise<ConversationView> {
    const seller = await this.prisma.seller.findFirst({
      where: { handle: input.sellerHandle, status: 'ACTIVE' },
      select: { id: true, displayName: true },
    });
    if (!seller) throw new NotFoundException('Store not found.');
    const member = await this.prisma.sellerMember.findUnique({ where: { userId: customerId } });
    if (member?.sellerId === seller.id) {
      throw new BadRequestException('You can’t message your own store.');
    }
    let productTitle: string | null = null;
    if (input.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: input.productId, sellerId: seller.id },
        select: { title: true },
      });
      if (!product) throw new BadRequestException('That product isn’t sold by this store.');
      productTitle = product.title;
    }
    let orderId: string | null = null;
    if (input.orderNumber) {
      const order = await this.prisma.order.findFirst({
        where: {
          number: input.orderNumber,
          userId: customerId,
          items: { some: { sellerId: seller.id } },
        },
        select: { id: true },
      });
      if (!order) throw new BadRequestException('That order has nothing from this store.');
      orderId = order.id;
    }
    // Same store and topic, still open: keep talking in the same thread.
    const open = await this.prisma.conversation.findFirst({
      where: {
        customerId,
        sellerId: seller.id,
        productId: input.productId ?? null,
        orderId,
        closedAt: null,
        hiddenAt: null,
      },
      select: { id: true },
    });
    const id =
      open?.id ??
      (
        await this.prisma.conversation.create({
          data: {
            customerId,
            sellerId: seller.id,
            productId: input.productId ?? null,
            orderId,
            subject: input.orderNumber
              ? `Order ${input.orderNumber}`
              : (productTitle ?? `Question for ${seller.displayName}`),
          },
          select: { id: true },
        })
      ).id;
    return this.send(id, 'customer', customerId, input.body);
  }

  async mine(customerId: string): Promise<ConversationSummary[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { customerId, hiddenAt: null },
      include,
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });
    return this.summaries(rows, 'customer');
  }

  async forCustomer(customerId: string, id: string): Promise<ConversationView> {
    const row = await this.prisma.conversation.findFirst({
      where: { id, customerId, hiddenAt: null },
      include,
    });
    if (!row) throw new NotFoundException('Conversation not found.');
    await this.prisma.conversation.update({
      where: { id },
      data: { customerReadAt: new Date() },
    });
    return this.view(row, 'customer');
  }

  async customerReply(customerId: string, id: string, body: string): Promise<ConversationView> {
    await this.forCustomer(customerId, id);
    return this.send(id, 'customer', customerId, body);
  }

  // ───── Stores ─────

  async sellerOf(userId: string): Promise<string> {
    const member = await this.prisma.sellerMember.findUnique({
      where: { userId },
      select: { sellerId: true },
    });
    if (!member) throw new ForbiddenException('Set up your seller account first.');
    return member.sellerId;
  }

  async forSellerList(sellerId: string): Promise<ConversationSummary[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { sellerId, hiddenAt: null },
      include,
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
    });
    return this.summaries(rows, 'seller');
  }

  async forSeller(sellerId: string, id: string): Promise<ConversationView> {
    const row = await this.prisma.conversation.findFirst({
      where: { id, sellerId, hiddenAt: null },
      include,
    });
    if (!row) throw new NotFoundException('Conversation not found.');
    await this.prisma.conversation.update({ where: { id }, data: { sellerReadAt: new Date() } });
    return this.view(row, 'seller');
  }

  async sellerReply(
    sellerId: string,
    userId: string,
    id: string,
    body: string,
  ): Promise<ConversationView> {
    await this.forSeller(sellerId, id);
    return this.send(id, 'seller', userId, body);
  }

  async setClosed(sellerId: string, id: string, closed: boolean): Promise<ConversationView> {
    await this.forSeller(sellerId, id);
    await this.prisma.conversation.update({
      where: { id },
      data: { closedAt: closed ? new Date() : null },
    });
    return this.forSeller(sellerId, id);
  }

  /** Either side flags a thread (scam, abuse, off-platform payment) for staff. */
  async report(side: Side, ownerId: string, id: string, reason: string): Promise<ConversationView> {
    if (side === 'customer') await this.forCustomer(ownerId, id);
    else await this.forSeller(ownerId, id);
    await this.prisma.conversation.update({
      where: { id },
      data: { reportedAt: new Date(), reportReason: reason },
    });
    await this.audit.record({
      action: 'messages.reported',
      actorId: side === 'customer' ? ownerId : null,
      entityType: 'conversation',
      entityId: id,
      metadata: { side, reason },
    });
    return side === 'customer' ? this.forCustomer(ownerId, id) : this.forSeller(ownerId, id);
  }

  // ───── Staff ─────

  async adminList(reportedOnly: boolean): Promise<AdminConversationView[]> {
    const rows = await this.prisma.conversation.findMany({
      where: reportedOnly ? { reportedAt: { not: null } } : {},
      include,
      orderBy: reportedOnly ? { reportedAt: 'desc' } : { lastMessageAt: 'desc' },
      take: 100,
    });
    return Promise.all(rows.map((row) => this.adminView(row)));
  }

  async adminGet(id: string): Promise<AdminConversationView> {
    const row = await this.prisma.conversation.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException('Conversation not found.');
    return this.adminView(row);
  }

  async moderate(
    staffId: string,
    id: string,
    action: 'hide' | 'restore' | 'dismiss',
  ): Promise<AdminConversationView> {
    await this.adminGet(id);
    await this.prisma.conversation.update({
      where: { id },
      data:
        action === 'hide'
          ? { hiddenAt: new Date(), closedAt: new Date() }
          : action === 'restore'
            ? { hiddenAt: null }
            : { reportedAt: null, reportReason: null },
    });
    await this.audit.record({
      action: `messages.${action}`,
      actorId: staffId,
      entityType: 'conversation',
      entityId: id,
    });
    return this.adminGet(id);
  }

  // ───── Shared ─────

  private async send(
    id: string,
    side: Side,
    userId: string,
    text: string,
  ): Promise<ConversationView> {
    const { body, redacted } = redactContacts(text.trim());
    const now = new Date();
    const author: MessageAuthor = side === 'customer' ? 'CUSTOMER' : 'SELLER';
    await this.prisma.$transaction([
      this.prisma.conversationMessage.create({
        data: { conversationId: id, author, authorUserId: userId, body, redacted },
      }),
      this.prisma.conversation.update({
        where: { id },
        data: {
          lastMessageAt: now,
          // Writing reopens a closed thread, and you have read your own message.
          closedAt: null,
          ...(side === 'customer' ? { customerReadAt: now } : { sellerReadAt: now }),
        },
      }),
    ]);
    const row = await this.prisma.conversation.findUniqueOrThrow({ where: { id }, include });
    await this.notify(row, side, body);
    return this.view(row, side);
  }

  /** Tells the other side, by email (and push for customers), with a link back. */
  private async notify(row: Row, from: Side, body: string): Promise<void> {
    const web = this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
    const toCustomer = from === 'seller';
    const locale = toLocale(toCustomer ? row.customer.language : 'en');
    const t = translator(locale)('email');
    const vars = {
      from: toCustomer ? row.seller.displayName : authorName(row.customer),
      subject: row.subject,
      body,
      link: toCustomer ? `${web}/account/messages/${row.id}` : `${web}/sell/messages/${row.id}`,
    };
    await this.mail.trySend({
      to: toCustomer ? row.customer.email : row.seller.contactEmail,
      subject: t('msg_new_subject', vars),
      text: t('msg_new_text', vars),
      template: 'messages.new',
      data: { link: vars.link, conversationId: row.id },
    });
    if (toCustomer) {
      await this.push
        .sendToUser(row.customer.id, {
          title: t('push_message_title', vars),
          body: body.slice(0, 140),
          data: { path: `/messages/${row.id}` },
        })
        .catch(() => 0);
    }
  }

  private async context(rows: Row[]) {
    const productIds = rows.map((r) => r.productId).filter((v): v is string => Boolean(v));
    const orderIds = rows.map((r) => r.orderId).filter((v): v is string => Boolean(v));
    const [products, orders] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          slug: true,
          title: true,
          images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
        },
      }),
      this.prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, number: true },
      }),
    ]);
    return {
      product: new Map(products.map((p) => [p.id, p])),
      order: new Map(orders.map((o) => [o.id, o.number])),
    };
  }

  private summary(
    row: Row,
    side: Side,
    ctx: Awaited<ReturnType<MessagingService['context']>>,
  ): ConversationSummary {
    const last = row.messages.at(-1);
    const product = row.productId ? ctx.product.get(row.productId) : undefined;
    const readAt = side === 'customer' ? row.customerReadAt : row.sellerReadAt;
    const fromOther = last && last.author !== (side === 'customer' ? 'CUSTOMER' : 'SELLER');
    return {
      id: row.id,
      subject: row.subject,
      with: side === 'customer' ? row.seller.displayName : authorName(row.customer),
      sellerHandle: row.seller.handle,
      product: product
        ? {
            slug: product.slug,
            title: product.title,
            imageUrl: product.images[0]
              ? this.storage.publicUrl(product.images[0].storageKey)
              : null,
          }
        : null,
      orderNumber: row.orderId ? (ctx.order.get(row.orderId) ?? null) : null,
      lastMessage: last
        ? { author: last.author, body: last.body.slice(0, 160), at: last.createdAt.toISOString() }
        : null,
      unread: Boolean(fromOther && (!readAt || readAt < last.createdAt)),
      closed: Boolean(row.closedAt),
    };
  }

  private async summaries(rows: Row[], side: Side): Promise<ConversationSummary[]> {
    const ctx = await this.context(rows);
    return rows.map((row) => this.summary(row, side, ctx));
  }

  private async view(row: Row, side: Side): Promise<ConversationView> {
    const ctx = await this.context([row]);
    return {
      ...this.summary(row, side, ctx),
      unread: false,
      reported: Boolean(row.reportedAt),
      messages: row.messages.map((m) => ({
        id: m.id,
        author: m.author,
        body: m.body,
        redacted: m.redacted,
        at: m.createdAt.toISOString(),
      })),
    };
  }

  private async adminView(row: Row): Promise<AdminConversationView> {
    const base = await this.view(row, 'seller');
    return {
      ...base,
      with: authorName(row.customer),
      customerEmail: row.customer.email,
      sellerName: row.seller.displayName,
      reportReason: row.reportReason,
      hidden: Boolean(row.hiddenAt),
    };
  }
}
