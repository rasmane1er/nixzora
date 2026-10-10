import { createHmac, randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatters, type Locale, translator } from '@nixzora/i18n';
import {
  type AdminGiftCardView,
  type CheckoutResponse,
  type GiftBalanceView,
  type GiftCardPurchase,
  type GiftCreditGrant,
} from '@nixzora/validation';
import { toLocale } from '../../common/locale';
import { type RequestMeta } from '../../common/request-meta';
import { type Env } from '../../config/env';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../identity/auth-user';
import { MailService } from '../notifications/mail.service';
import { OutboxService } from '../outbox/outbox.service';
import { RiskService } from '../risk/risk.service';
import { giftBalance } from './gift-ledger';
import { newOrderNumber, orderAccessToken, orderInclude, type OrderRow } from './order-links';
import { OrdersService } from './orders.service';
import { PaymentCardsService } from './payment-cards.service';

/** No 0/O, 1/I/L: easy to read off a screen and type. 31 symbols × 16 ≈ 79 bits. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 16;

/** "abcd efgh-jkmn pqrs" → "ABCDEFGHJKMNPQRS". */
export function normalizeGiftCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function newGiftCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code.match(/.{4}/g)!.join('-');
}

/**
 * E-gift cards (p10-10). Bought like an order (no shipping, no tax), paid by card, then issued:
 * a random code is emailed once to the recipient and only its keyed hash is kept. Redeeming adds
 * the amount to the account's gift card balance, which checkout spends first. No expiry, no fees.
 */
@Injectable()
export class GiftCardsService implements OnModuleInit {
  private readonly logger = new Logger(GiftCardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly cards: PaymentCardsService,
    private readonly risk: RiskService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    this.outbox.on('order.paid', async ({ aggregateId }) => {
      await this.issue(aggregateId);
    });
    // Held for a fraud review: sent once staff clear it.
    this.outbox.on('risk.order_cleared', async ({ aggregateId }) => {
      await this.issue(aggregateId);
    });
  }

  private hash(code: string): string {
    return createHmac('sha256', this.config.get('ORDER_LINK_SECRET', { infer: true }))
      .update(`gift-card:${normalizeGiftCode(code)}`)
      .digest('hex');
  }

  // ───── Buying ─────

  async purchase(
    user: AuthUser,
    input: GiftCardPurchase,
    meta: RequestMeta,
    locale: Locale,
  ): Promise<CheckoutResponse> {
    if (!user.permissions.includes('orders.create')) {
      throw new ForbiddenException('This account cannot place orders.');
    }
    const card = input.paymentCardId ? await this.cards.usable(user.id, input.paymentCardId) : null;
    // Gift cards are cash-like: the same fraud signals as any order (ADR-0024).
    const assessment = await this.risk.assessCheckout({
      email: user.email,
      userId: user.id,
      ipAddress: meta.ipAddress,
      totalCents: input.amountCents,
      quantities: [1],
    });
    if (assessment?.decision === 'BLOCK' && assessment.enforced) {
      await this.risk.recordCheckout(assessment, null);
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'ORDER_DECLINED',
        message:
          'We could not accept this order. If you think this is a mistake, contact support and we will look into it.',
      });
    }
    const label = formatters(locale).money(input.amountCents);
    const order: OrderRow = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number: newOrderNumber(),
          kind: 'GIFT_CARD',
          userId: user.id,
          email: user.email,
          currency: 'USD',
          subtotalCents: input.amountCents,
          totalCents: input.amountCents,
          language: locale,
          // Nothing ships: the "address" says where the card goes.
          shippingAddress: {
            fullName: input.recipientName,
            line1: input.recipientEmail,
            city: '',
            region: '',
            postalCode: '',
            country: 'US',
          } as Prisma.InputJsonObject,
          riskHold: assessment?.decision === 'REVIEW' && assessment.enforced,
          items: {
            create: [
              {
                productTitle: 'NIXZORA gift card',
                variantTitle: `${label} · ${input.recipientName}`,
                sku: 'GIFT-CARD',
                unitPriceCents: input.amountCents,
                quantity: 1,
                totalCents: input.amountCents,
              },
            ],
          },
          giftCards: {
            create: [
              {
                amountCents: input.amountCents,
                recipientEmail: input.recipientEmail.trim().toLowerCase(),
                recipientName: input.recipientName,
                senderName: input.senderName,
                message: input.message ?? null,
              },
            ],
          },
        },
        include: orderInclude,
      });
      if (assessment) await this.risk.recordCheckout(assessment, created.id, tx);
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'order',
          aggregateId: created.id,
          type: 'order.created',
          payload: { number: created.number, totalCents: created.totalCents },
        },
      });
      return created;
    });
    return this.orders.startPayment(order, user, {
      card,
      saveCard: false,
      // A gift card can't be bought with gift card balance.
      useGiftBalance: false,
      cartOwner: null,
      meta,
      totals: {
        currency: 'USD',
        subtotalCents: input.amountCents,
        discountCents: 0,
        shippingCents: 0,
        taxCents: 0,
        totalCents: input.amountCents,
        freeShippingRemainingCents: 0,
      },
    });
  }

  /**
   * Once a gift card order is paid: make each card's code, email it to the recipient, tell the
   * buyer, and mark the order delivered. Safe to run twice (only PENDING cards are issued),
   * and held while the order waits for a fraud review.
   */
  async issue(orderId: string): Promise<number> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { giftCards: { where: { status: 'PENDING' } } },
    });
    if (!order || order.kind !== 'GIFT_CARD' || order.riskHold) return 0;
    if (order.status !== 'PAID') return 0;
    const locale = toLocale(order.language);
    const t = translator(locale)('email');
    const money = formatters(locale).money;
    const web = this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
    let sent = 0;
    for (const card of order.giftCards) {
      const code = newGiftCode();
      const issued = await this.prisma.giftCard.updateMany({
        where: { id: card.id, status: 'PENDING' },
        data: {
          status: 'ACTIVE',
          codeHash: this.hash(code),
          last4: normalizeGiftCode(code).slice(-4),
          sentAt: new Date(),
        },
      });
      if (!issued.count) continue;
      const vars = {
        recipient: card.recipientName,
        sender: card.senderName,
        amount: money(card.amountCents),
        message: card.message ? `\n“${card.message}”\n` : '',
        code,
        link: `${web}/account/gift-cards`,
      };
      await this.mail.trySend({
        to: card.recipientEmail,
        subject: t('giftCard_subject', vars),
        text: t('giftCard_text', vars),
        template: 'gift-cards.received',
        data: { amount: vars.amount, sender: card.senderName, code, link: vars.link },
      });
      const token = orderAccessToken(
        this.config.get('ORDER_LINK_SECRET', { infer: true }),
        order.id,
      );
      const sentVars = {
        recipient: card.recipientName,
        email: card.recipientEmail,
        amount: vars.amount,
        number: order.number,
        orderLink: `${web}/orders/${order.number}?token=${token}`,
      };
      await this.mail.trySend({
        to: order.email,
        subject: t('giftCard_sent_subject', sentVars),
        text: t('giftCard_sent_text', sentVars),
        template: 'gift-cards.sent',
        data: { amount: vars.amount, recipient: card.recipientName },
      });
      sent++;
    }
    if (sent) {
      // Nothing ships: sent is delivered.
      const now = new Date();
      await this.prisma.order.updateMany({
        where: { id: order.id, status: 'PAID' },
        data: { status: 'DELIVERED', fulfillingAt: now, shippedAt: now, deliveredAt: now },
      });
    }
    return sent;
  }

  // ───── The balance ─────

  async balance(userId: string): Promise<GiftBalanceView> {
    const [balanceCents, entries] = await Promise.all([
      this.prisma.$transaction((tx) => giftBalance(tx, userId)),
      this.prisma.giftBalanceEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { order: { select: { number: true } } },
      }),
    ]);
    return {
      balanceCents,
      entries: entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        amountCents: entry.amountCents,
        note: entry.kind === 'GRANT' || entry.kind === 'REDEEM' ? entry.note : null,
        orderNumber: entry.order?.number ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  async redeem(user: AuthUser, code: string, meta: RequestMeta): Promise<GiftBalanceView> {
    const normalized = normalizeGiftCode(code);
    if (normalized.length !== CODE_LENGTH) {
      throw new BadRequestException('Gift card codes have 16 letters and numbers.');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const card = await tx.giftCard.findUnique({ where: { codeHash: this.hash(normalized) } });
      if (!card) return 'unknown' as const;
      const claimed = await tx.giftCard.updateMany({
        where: { id: card.id, status: 'ACTIVE' },
        data: { status: 'REDEEMED', redeemedById: user.id, redeemedAt: new Date() },
      });
      if (!claimed.count) return card.status === 'REDEEMED' ? ('used' as const) : ('void' as const);
      await giftBalance(tx, user.id, true);
      await tx.giftBalanceEntry.create({
        data: {
          userId: user.id,
          kind: 'REDEEM',
          amountCents: card.amountCents,
          giftCardId: card.id,
          note: card.senderName ? `From ${card.senderName}` : null,
        },
      });
      return card;
    });
    await this.audit.record({
      action: typeof result === 'string' ? 'gift_cards.redeem_failed' : 'gift_cards.redeemed',
      actorId: user.id,
      entityType: 'gift_card',
      entityId: typeof result === 'string' ? user.id : result.id,
      meta,
      metadata:
        typeof result === 'string' ? { reason: result } : { amountCents: result.amountCents },
    });
    if (result === 'unknown') {
      throw new NotFoundException('That code doesn’t match a gift card. Check it and try again.');
    }
    if (result === 'used') throw new ConflictException('That gift card was already redeemed.');
    if (result === 'void') throw new ConflictException('That gift card can no longer be used.');
    return this.balance(user.id);
  }

  // ───── Ops ─────

  async adminList(query: { q?: string }): Promise<AdminGiftCardView[]> {
    const q = query.q?.trim().toLowerCase();
    const rows = await this.prisma.giftCard.findMany({
      where: q
        ? {
            OR: [
              { recipientEmail: { contains: q } },
              { order: { email: { contains: q } } },
              { order: { number: q.toUpperCase() } },
              { last4: q.toUpperCase().slice(-4) },
            ],
          }
        : {},
      include: { order: { select: { number: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((card) => ({
      id: card.id,
      amountCents: card.amountCents,
      recipientName: card.recipientName,
      recipientEmail: card.recipientEmail,
      status: card.status,
      last4: card.last4,
      sentAt: card.sentAt?.toISOString() ?? null,
      orderNumber: card.order.number,
      senderName: card.senderName,
      purchaserEmail: card.order.email,
      redeemedAt: card.redeemedAt?.toISOString() ?? null,
      createdAt: card.createdAt.toISOString(),
    }));
  }

  /** Goodwill credit to a customer's gift card balance. */
  async grant(
    actor: { user: AuthUser; meta: RequestMeta },
    userId: string,
    input: GiftCreditGrant,
  ): Promise<GiftBalanceView> {
    const customer = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!customer) throw new NotFoundException('Customer not found.');
    const entry = await this.prisma.giftBalanceEntry.create({
      data: {
        userId,
        kind: 'GRANT',
        amountCents: input.amountCents,
        note: input.note,
        createdById: actor.user.id,
      },
    });
    await this.audit.record({
      action: 'gift_cards.credit_granted',
      actorId: actor.user.id,
      entityType: 'user',
      entityId: userId,
      meta: actor.meta,
      metadata: { amountCents: input.amountCents, note: input.note, entryId: entry.id },
    });
    return this.balance(userId);
  }
}
