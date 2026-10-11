import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_LOCALE, type Locale } from '@nixzora/i18n';
import {
  GIFT_WRAP_CENTS,
  type AdminOrderListQuery,
  type CheckoutRequest,
  type CheckoutResponse,
  type OrderFulfillment,
  type OrderSummary,
  type OrderView,
  pagedResult,
  type PagedResult,
  type PaymentSession,
  type Totals,
  type RefundRequest,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { type RequestMeta } from '../../common/request-meta';
import { isUniqueViolation } from '../../common/prisma-errors';
import { type Env } from '../../config/env';
import { withTracking } from '../shipping/tracking';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { type CartOwner, CartService } from '../cart/cart.service';
import { PricingService } from '../cart/pricing.service';
import { giftBalance, releaseGiftBalance, spendGiftBalance } from './gift-ledger';
import { PaymentCardsService } from './payment-cards.service';
import { type AuthUser } from '../identity/auth-user';
import { InventoryService } from '../inventory/inventory.service';
import { CouponsService } from '../promotions/coupons.service';
import { type CheckoutAssessment, RiskService } from '../risk/risk.service';
import { RefundsService } from './refunds.service';
import {
  PAYMENT_GATEWAY,
  type PaymentEvent,
  type PaymentGateway,
} from '../payments/payment-gateway';
import {
  assertNoSellerShipped,
  hasSellerItems,
  markPartsDelivered,
  settleShipment,
  splitBySeller,
} from './marketplace';
import {
  cancellableUntil,
  newOrderNumber,
  orderAccessToken,
  orderInclude,
  type OrderRow,
  toOrderView,
  verifyOrderAccessToken,
} from './order-links';
import { runsBackgroundJobs } from '../../common/background-jobs';

const STALE_ORDER_HOURS = 24;
const SWEEP_MS = 10 * 60_000;

/**
 * Checkout, payment results and fulfillment.
 *
 * Checkout: price the cart on the server → hold stock → create the order (prices, titles and
 * address snapshotted) → create a payment intent. The order becomes PAID only when the
 * provider's signed webhook says so; the same transaction takes the units out of stock and
 * writes an outbox event (receipt email). Duplicate webhooks are ignored.
 */
/** A Subscribe & Save delivery (p10-11), placed by the subscriptions sweep. */
export type SubscriptionCheckout = {
  percentOff: number;
  /** variantId → the subscription it is for, recorded on each order line. */
  byVariant: Map<string, string>;
  /** Charged while the customer is away (every delivery after the first). */
  offSession: boolean;
};

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly carts: CartService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
    private readonly coupons: CouponsService,
    private readonly refunds: RefundsService,
    private readonly risk: RiskService,
    private readonly cards: PaymentCardsService,
    private readonly pricing: PricingService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  onModuleInit(): void {
    if (!runsBackgroundJobs(this.config)) return;
    this.sweeper = setInterval(() => void this.cancelStaleOrders(), SWEEP_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  private get linkSecret(): string {
    return this.config.get('ORDER_LINK_SECRET', { infer: true });
  }

  accessToken(orderId: string): string {
    return orderAccessToken(this.linkSecret, orderId);
  }

  // ───────────── Checkout ─────────────

  async checkout(
    input: CheckoutRequest,
    user: AuthUser | undefined,
    meta: RequestMeta,
    locale: Locale = DEFAULT_LOCALE,
    /** Subscribe & Save deliveries (p10-11): never from the public API. */
    subscription?: SubscriptionCheckout,
  ): Promise<CheckoutResponse> {
    if (user && !user.permissions.includes('orders.create')) {
      throw new ConflictException('This account cannot place orders.');
    }
    const owner: CartOwner | null = input.buyNowId
      ? { buyNowId: input.buyNowId }
      : user
        ? { userId: user.id }
        : input.cartId
          ? { guestId: input.cartId }
          : null;
    if (!owner) throw new BadRequestException('Your cart is empty.');

    const cart = this.subscribed(
      await this.carts.view(owner, input.shippingAddress.region, user?.id),
      subscription,
      input.shippingAddress.region,
    );
    if (!cart.lines.length) throw new BadRequestException('Your cart is empty.');
    const problems = cart.lines.filter((line) => line.problem);
    if (problems.length) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'CART_CHANGED',
        message: `Some items changed: ${problems.map((p) => p.productTitle).join(', ')}. Review your cart.`,
        cart,
      });
    }

    // Gift options (p10-22): wrap only what NIXZORA ships; the fee is added after tax.
    const wrapCents = input.gift?.wrap && !subscription ? GIFT_WRAP_CENTS : 0;
    if (wrapCents && !cart.giftWrap) {
      throw new BadRequestException(
        'Gift wrap is only for items NIXZORA ships. Untick it to continue.',
      );
    }
    if (wrapCents) {
      cart.totals = {
        ...cart.totals,
        giftWrapCents: wrapCents,
        totalCents: cart.totals.totalCents + wrapCents,
      };
    }

    if (cart.coupon?.problem) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'COUPON_INVALID',
        message: `${cart.coupon.code}: ${cart.coupon.problem} Remove it or try another code.`,
      });
    }

    const items = cart.lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
    }));

    // Saved cards (p10-09): only for the signed-in customer who saved them.
    if ((input.paymentCardId || input.saveCard) && !user) {
      throw new BadRequestException('Sign in to use or save a card.');
    }
    const card = input.paymentCardId
      ? await this.cards.usable(user!.id, input.paymentCardId)
      : null;

    // Fraud signals (ADR-0024): decline the worst before holding any stock.
    const assessment = await this.risk.assessCheckout({
      email: user?.email ?? input.email,
      userId: user?.id ?? null,
      ipAddress: meta.ipAddress,
      totalCents: cart.totals.totalCents,
      quantities: items.map((item) => item.quantity),
    });
    if (assessment?.decision === 'BLOCK' && assessment.enforced) {
      await this.risk.recordCheckout(assessment, null);
      await this.audit.record({
        action: 'orders.checkout.declined',
        actorId: user?.id ?? null,
        entityType: 'checkout',
        entityId: user?.id ?? assessment.email,
        meta,
        metadata: { score: assessment.score, signals: assessment.signals.map((s) => s.code) },
      });
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'ORDER_DECLINED',
        message:
          'We could not accept this order. If you think this is a mistake, contact support and we will look into it.',
      });
    }

    const holdMinutes = this.config.get('CHECKOUT_HOLD_MINUTES', { infer: true });
    const holds = await this.inventory.reserve(items, null, holdMinutes);

    let order: OrderRow;
    try {
      order = await this.createOrder(
        input,
        user,
        cart.lines,
        cart.totals,
        holds,
        cart.coupon && !cart.coupon.problem ? cart.coupon.code : null,
        locale,
        assessment,
        subscription?.byVariant,
      );
    } catch (error) {
      await this.inventory.release(holds);
      throw error;
    }

    return this.startPayment(order, user, {
      card,
      saveCard: Boolean(user && input.saveCard && !card),
      useGiftBalance: Boolean(user && input.useGiftBalance),
      cartOwner: owner,
      meta,
      saveAddress: user && input.saveAddress ? input.shippingAddress : null,
      totals: cart.totals,
      offSession: subscription?.offSession ?? false,
    });
  }

  /**
   * Subscribe & Save prices (p10-11): every line at the delivery's discount, rounded to the cent;
   * shipping and tax recomputed on the lower total. The store selling it funds the discount
   * (its earnings come from the line totals).
   */
  private subscribed(
    cart: Awaited<ReturnType<CartService['view']>>,
    subscription: SubscriptionCheckout | undefined,
    region: string,
  ): Awaited<ReturnType<CartService['view']>> {
    if (!subscription) return cart;
    const lines = cart.lines.map((line) => {
      const unit = Math.round((line.unitPriceCents * (100 - subscription.percentOff)) / 100);
      return {
        ...line,
        compareAtCents: line.unitPriceCents,
        unitPriceCents: unit,
        lineTotalCents: unit * line.quantity,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    // A Plus member's shipping stays free (p10-15).
    const plus = {
      member: cart.totals.shippingWaivedCents !== undefined,
      twoDay: cart.totals.shippingSpeed === 'TWO_DAY',
    };
    return {
      ...cart,
      lines,
      coupon: null,
      bundles: [],
      multiBuys: [],
      spendOffers: [],
      clippedCoupons: [],
      totals: this.pricing.totals(subtotal, region, 0, 'USD', plus),
    };
  }

  /**
   * Pays for a new order: gift card balance first (p10-10), then a saved card at once (p10-09)
   * or a payment session for the payment form. A balance that covers everything, or a saved
   * card that goes through, leaves the order paid when this returns.
   */
  async startPayment(
    order: OrderRow,
    user: AuthUser | undefined,
    options: {
      card: { id: string; providerMethodId: string } | null;
      saveCard: boolean;
      useGiftBalance: boolean;
      cartOwner: CartOwner | null;
      meta: RequestMeta;
      saveAddress?: CheckoutRequest['shippingAddress'] | null;
      totals: Totals;
      /** The customer is not there (Subscribe & Save): no 3-D Secure possible. */
      offSession?: boolean;
    },
  ): Promise<CheckoutResponse> {
    const { card, saveCard } = options;
    let giftCents = 0;
    if (user && options.useGiftBalance && order.kind === 'GOODS') {
      giftCents = await this.prisma.$transaction(async (tx) => {
        const cents = Math.min(await giftBalance(tx, user.id, true), order.totalCents);
        if (cents <= 0) return 0;
        await spendGiftBalance(tx, user.id, order.id, cents);
        await tx.order.update({ where: { id: order.id }, data: { giftBalanceCents: cents } });
        await tx.payment.create({
          data: {
            orderId: order.id,
            provider: 'GIFT_BALANCE',
            providerPaymentId: `gift_${order.id}`,
            // Taken now; the order is paid once the card part (if any) goes through.
            status: cents < order.totalCents ? 'SUCCEEDED' : 'REQUIRES_ACTION',
            amountCents: cents,
            currency: order.currency,
          },
        });
        return cents;
      });
    }
    const cardCents = order.totalCents - giftCents;

    let intent: Awaited<ReturnType<PaymentGateway['createIntent']>> | null = null;
    if (cardCents > 0) {
      try {
        const customerId = user && (card || saveCard) ? await this.cards.customerFor(user) : null;
        intent = await this.gateway.createIntent({
          amountCents: cardCents,
          currency: order.currency,
          orderId: order.id,
          orderNumber: order.number,
          email: order.email,
          idempotencyKey: `order-${order.id}`,
          customerId,
          saveCard,
          paymentMethodId: card?.providerMethodId ?? null,
          offSession: options.offSession ?? false,
        });
        await this.prisma.payment.create({
          data: {
            orderId: order.id,
            provider: this.gateway.name,
            providerPaymentId: intent.id,
            status: 'REQUIRES_ACTION',
            amountCents: cardCents,
            currency: order.currency,
            saveCard,
            paymentCardId: card?.id ?? null,
          },
        });
      } catch (error) {
        this.logger.error(`Payment intent failed for ${order.number}: ${(error as Error).message}`);
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelReason: 'Payment service unavailable',
          },
        });
        await this.releaseUnpaid(order);
        throw new BadGatewayException(
          'Payments are temporarily unavailable. You have not been charged.',
        );
      }
    }

    // Remember which cart to empty once the payment succeeds.
    if (options.cartOwner) {
      await this.redis.client
        .set(`order-cart:${order.id}`, JSON.stringify(options.cartOwner), 'EX', 3 * 24 * 3600)
        .catch(() => undefined);
    }
    if (user && options.saveAddress) await this.saveAddress(user.id, options.saveAddress);

    await this.audit.record({
      action: 'orders.checkout.started',
      actorId: user?.id ?? null,
      entityType: 'order',
      entityId: order.id,
      meta: options.meta,
      metadata: {
        number: order.number,
        totalCents: order.totalCents,
        items: order.items.length,
        ...(giftCents ? { giftBalanceCents: giftCents } : {}),
      },
    });

    // Paid already: all by gift balance, or a saved card that went through. (Stripe also sends
    // its webhook; applying the same success twice changes nothing.)
    const paidBy = !intent ? `gift_${order.id}` : intent.status === 'succeeded' ? intent.id : null;
    if (paidBy) {
      await this.applyPaymentEvent({
        id: `sync_${paidBy}`,
        type: 'succeeded',
        paymentId: paidBy,
        amountCents: intent ? cardCents : giftCents,
        currency: order.currency,
      });
    }

    return {
      orderId: order.id,
      orderNumber: order.number,
      accessToken: this.accessToken(order.id),
      payment: this.session(intent?.clientSecret ?? '', cardCents, order.currency),
      totals: options.totals,
      paid: Boolean(paidBy),
      paymentProblem:
        intent?.status === 'failed'
          ? (intent.failure ?? 'Your card was declined. Try another card.')
          : intent?.status === 'requires_action'
            ? 'Your bank wants to confirm this payment. Finish it on the payment page.'
            : null,
    };
  }

  /** The pay page reloaded: same payment, holds renewed if they lapsed. */
  async paymentSession(order: OrderRow): Promise<PaymentSession> {
    if (order.status !== 'PENDING_PAYMENT') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ORDER_NOT_PAYABLE',
        message:
          order.status === 'CANCELLED'
            ? 'This order was cancelled.'
            : 'This order is already paid.',
      });
    }
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: order.id, provider: { not: 'GIFT_BALANCE' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new NotFoundException('No payment found for this order.');
    await this.inventory.holdForOrder(
      order.id,
      order.items
        .filter((item) => item.variantId)
        .map((item) => ({ variantId: item.variantId!, quantity: item.quantity })),
      this.config.get('CHECKOUT_HOLD_MINUTES', { infer: true }),
    );
    return this.session(
      await this.gateway.clientSecret(payment.providerPaymentId),
      payment.amountCents,
      payment.currency,
    );
  }

  private session(clientSecret: string, amountCents: number, currency: string): PaymentSession {
    return {
      provider: this.gateway.name,
      clientSecret,
      publishableKey: this.gateway.publishableKey,
      amountCents,
      currency,
    };
  }

  private async createOrder(
    input: CheckoutRequest,
    user: AuthUser | undefined,
    lines: Awaited<ReturnType<CartService['view']>>['lines'],
    totals: Awaited<ReturnType<CartService['view']>>['totals'],
    holds: string[],
    couponCode: string | null,
    language: Locale,
    assessment: CheckoutAssessment | null,
    subscriptionByVariant?: Map<string, string>,
  ): Promise<OrderRow> {
    // Bundle & save (p10-16): who funds each bundle's discount (a store, or NIXZORA).
    const funded: Record<string, number> = {};
    // Buy X, get Y (p10-27): the same, and what each offer saved.
    const multiFunded: Record<string, number> = {};
    const multiUses: Record<string, number> = {};
    // Spend more, save more (p10-31): the same.
    const spendFunded: Record<string, number> = {};
    const spendUses: Record<string, number> = {};
    if (totals.bundleDiscountCents || totals.multiBuyDiscountCents || totals.spendDiscountCents) {
      const savings = await this.carts.savings(lines);
      for (const saving of savings.bundles) {
        const key = saving.sellerId ?? 'nixzora';
        funded[key] = (funded[key] ?? 0) + saving.discountCents;
      }
      for (const saving of savings.multiBuys.filter((m) => m.discountCents)) {
        const key = saving.sellerId ?? 'nixzora';
        multiFunded[key] = (multiFunded[key] ?? 0) + saving.discountCents;
        multiUses[saving.id] = saving.discountCents;
      }
      for (const saving of savings.spends.filter((s) => s.discountCents)) {
        const key = saving.sellerId ?? 'nixzora';
        spendFunded[key] = (spendFunded[key] ?? 0) + saving.discountCents;
        spendUses[saving.id] = saving.discountCents;
      }
    }
    // Clipped coupons (p10-18): which clips this order uses, and who funds them.
    const clips = totals.clipDiscountCents && user ? await this.carts.clipped(user.id, lines) : [];
    const clipFunded: Record<string, number> = {};
    for (const clip of clips) {
      const key = clip.sellerId ?? 'nixzora';
      clipFunded[key] = (clipFunded[key] ?? 0) + clip.discountCents;
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          if (couponCode) {
            const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
            if (!coupon || !(await this.coupons.redeem(tx, coupon.id))) {
              throw new ConflictException({
                statusCode: 409,
                error: 'Conflict',
                code: 'COUPON_INVALID',
                message: `${couponCode} was just used up. Remove it to continue.`,
              });
            }
          }
          // Who sells each line, frozen at purchase (null = NIXZORA).
          const owners = new Map(
            (
              await tx.product.findMany({
                where: { id: { in: [...new Set(lines.map((line) => line.productId))] } },
                select: { id: true, sellerId: true },
              })
            ).map((product) => [product.id, product.sellerId]),
          );
          const order = await tx.order.create({
            data: {
              number: newOrderNumber(),
              userId: user?.id ?? null,
              email: user?.email ?? input.email,
              currency: totals.currency,
              subtotalCents: totals.subtotalCents,
              discountCents: totals.discountCents,
              couponCode,
              language,
              shippingCents: totals.shippingCents,
              taxCents: totals.taxCents,
              totalCents: totals.totalCents,
              bundleDiscountCents: totals.bundleDiscountCents ?? 0,
              clipDiscountCents: totals.clipDiscountCents ?? 0,
              ...(input.gift && !subscriptionByVariant
                ? {
                    isGift: true,
                    giftMessage: input.gift.message ?? null,
                    giftFrom: input.gift.from ?? null,
                    giftWrapCents: totals.giftWrapCents ?? 0,
                  }
                : {}),
              ...(totals.clipDiscountCents
                ? { clipDiscounts: clipFunded as Prisma.InputJsonObject }
                : {}),
              ...(totals.bundleDiscountCents
                ? { bundleDiscounts: funded as Prisma.InputJsonObject }
                : {}),
              ...(totals.multiBuyDiscountCents
                ? {
                    multiBuyDiscountCents: totals.multiBuyDiscountCents,
                    multiBuyDiscounts: multiFunded as Prisma.InputJsonObject,
                    multiBuyUses: multiUses as Prisma.InputJsonObject,
                  }
                : {}),
              ...(totals.spendDiscountCents
                ? {
                    spendDiscountCents: totals.spendDiscountCents,
                    spendDiscounts: spendFunded as Prisma.InputJsonObject,
                    spendUses: spendUses as Prisma.InputJsonObject,
                  }
                : {}),
              // NIXZORA Plus (p10-15): what membership changed on this order.
              shippingSpeed: totals.shippingSpeed ?? 'STANDARD',
              shippingWaivedCents: totals.shippingWaivedCents ?? 0,
              plusSavingsCents:
                (totals.shippingWaivedCents ?? 0) +
                lines.reduce(
                  (sum, line) =>
                    sum +
                    (line.regularPriceCents
                      ? (line.regularPriceCents - line.unitPriceCents) * line.quantity
                      : 0),
                  0,
                ),
              shippingAddress: input.shippingAddress as Prisma.InputJsonObject,
              riskHold: assessment?.decision === 'REVIEW' && assessment.enforced,
              items: {
                create: lines.map((line) => ({
                  variantId: line.variantId,
                  productTitle: line.productTitle,
                  variantTitle: line.variantTitle,
                  sku: line.sku,
                  unitPriceCents: line.unitPriceCents,
                  quantity: line.quantity,
                  totalCents: line.lineTotalCents,
                  sellerId: owners.get(line.productId) ?? null,
                  subscriptionId: subscriptionByVariant?.get(line.variantId) ?? null,
                  // Pre-orders (p10-30): the release day this line ships from.
                  shipsOn: line.releaseDate ? new Date(`${line.releaseDate}T00:00:00Z`) : null,
                })),
              },
            },
            include: orderInclude,
          });
          await tx.inventoryReservation.updateMany({
            where: { id: { in: holds } },
            data: { orderId: order.id },
          });
          // Each clipped coupon is used once: by this order, within the coupon's budget.
          for (const clip of clips) {
            const used = await tx.couponClip.updateMany({
              where: { id: clip.clipId, usedAt: null },
              data: { usedAt: new Date(), orderId: order.id },
            });
            const counted = await tx.$executeRaw`
              UPDATE clip_coupons SET redeemed = redeemed + 1, updated_at = now()
              WHERE id = ${clip.id}::uuid AND status = 'ACTIVE'
                AND (max_redemptions IS NULL OR redeemed < max_redemptions)`;
            if (!used.count || counted !== 1) {
              throw new ConflictException({
                statusCode: 409,
                error: 'Conflict',
                code: 'CART_CHANGED',
                message: `The coupon on ${clip.productTitle} just ran out. Review your cart.`,
              });
            }
          }
          if (assessment) await this.risk.recordCheckout(assessment, order.id, tx);
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'order',
              aggregateId: order.id,
              type: 'order.created',
              payload: { number: order.number, totalCents: order.totalCents },
            },
          });
          return order;
        });
      } catch (error) {
        // Order number collision (1 in ~900 million): try another number.
        if (isUniqueViolation(error) && attempt < 4) continue;
        throw error;
      }
    }
    throw new Error('unreachable');
  }

  private async saveAddress(
    userId: string,
    address: CheckoutRequest['shippingAddress'],
  ): Promise<void> {
    const existing = await this.prisma.address.findFirst({
      where: { userId, line1: address.line1, postalCode: address.postalCode },
    });
    if (existing) return;
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= 20) return;
    await this.prisma.address.create({
      data: {
        userId,
        fullName: address.fullName,
        line1: address.line1,
        line2: address.line2 ?? null,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        country: address.country,
        phone: address.phone ?? null,
        isDefaultShipping: count === 0,
      },
    });
  }

  // ───────────── Payment results ─────────────

  /** Applies a verified provider event exactly once. */
  async applyPaymentEvent(event: PaymentEvent): Promise<'applied' | 'duplicate' | 'ignored'> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId: event.paymentId },
      include: { order: { include: orderInclude } },
    });
    if (!payment) {
      this.logger.warn(`Payment event for unknown payment ${event.paymentId} ignored.`);
      return 'ignored';
    }

    let cancelledUnpaid = { count: 0 };
    const result = await this.prisma.$transaction(async (tx) => {
      try {
        await tx.processedWebhookEvent.create({
          data: { id: event.id, provider: payment.provider },
        });
      } catch (error) {
        if (isUniqueViolation(error)) return 'duplicate' as const;
        throw error;
      }

      const order = payment.order;
      switch (event.type) {
        case 'processing':
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'PROCESSING' } });
          return 'applied' as const;
        case 'failed':
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
          return 'applied' as const;
        case 'disputed':
          await tx.payment.updateMany({
            where: { id: payment.id, disputedAt: null },
            data: { disputedAt: new Date() },
          });
          return 'applied' as const;
        case 'canceled': {
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'CANCELED' } });
          cancelledUnpaid = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING_PAYMENT' },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelReason: 'Payment cancelled',
            },
          });
          return 'applied' as const;
        }
        case 'succeeded': {
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } });
          if (event.amountCents !== payment.amountCents || event.currency !== order.currency) {
            this.logger.error(
              `Amount mismatch on ${order.number}: paid ${event.amountCents} ${event.currency}`,
            );
          }
          const paid = await tx.order.updateMany({
            where: { id: order.id, status: { in: ['PENDING_PAYMENT', 'CANCELLED'] } },
            data: { status: 'PAID', placedAt: new Date(), cancelledAt: null, cancelReason: null },
          });
          if (paid.count === 0) return 'applied' as const;
          await splitBySeller(tx, order);
          const shortfall = await this.inventory.commitOrder(
            tx,
            order.id,
            order.items
              .filter((item) => item.variantId)
              .map((item) => ({ variantId: item.variantId!, quantity: item.quantity })),
          );
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'order',
              aggregateId: order.id,
              type: 'order.paid',
              payload: { number: order.number, totalCents: order.totalCents },
            },
          });
          if (shortfall.length) {
            await tx.outboxEvent.create({
              data: {
                aggregateType: 'order',
                aggregateId: order.id,
                type: 'order.stock_shortfall',
                payload: { number: order.number, shortfall },
              },
            });
          }
          return 'applied' as const;
        }
      }
    });

    if (result === 'applied' && event.type === 'disputed') {
      await this.risk.onDispute(payment.orderId);
      await this.audit.record({
        action: 'orders.disputed',
        actorType: 'SYSTEM',
        entityType: 'order',
        entityId: payment.orderId,
        metadata: { number: payment.order.number, amountCents: event.amountCents },
      });
    }
    if (result === 'applied' && event.type === 'succeeded') {
      await this.risk
        .afterPayment(payment.orderId, payment.providerPaymentId)
        .catch((error: Error) => this.logger.warn(`Payment risk check failed: ${error.message}`));
      await this.emptyCart(payment.orderId);
      await this.cards
        .rememberFromPayment(payment.providerPaymentId)
        .catch((error: Error) => this.logger.warn(`Saving a card failed: ${error.message}`));
      await this.audit.record({
        action: 'orders.paid',
        actorType: 'SYSTEM',
        entityType: 'order',
        entityId: payment.orderId,
        metadata: { number: payment.order.number, provider: payment.provider },
      });
    }
    if (result === 'applied' && event.type === 'canceled' && cancelledUnpaid.count) {
      await this.releaseUnpaid(payment.order);
    }
    return result;
  }

  /** An order that will never be paid gives back its stock holds and its coupon use. */
  private async releaseUnpaid(order: { id: string; couponCode: string | null }): Promise<void> {
    await this.inventory.releaseOrder(order.id);
    if (order.couponCode) await this.coupons.release(order.couponCode);
    // Clipped coupons (p10-18) come back to the customer, and to the coupon's budget.
    await this.prisma.$transaction(async (tx) => {
      const clips = await tx.couponClip.findMany({
        where: { orderId: order.id },
        select: { id: true, couponId: true },
      });
      for (const clip of clips) {
        await tx.couponClip.update({
          where: { id: clip.id },
          data: { usedAt: null, orderId: null },
        });
        await tx.$executeRaw`
          UPDATE clip_coupons SET redeemed = GREATEST(redeemed - 1, 0), updated_at = now()
          WHERE id = ${clip.couponId}::uuid`;
      }
    });
    await this.prisma.$transaction((tx) => releaseGiftBalance(tx, order.id));
  }

  /** What a payment is for (the fake gateway needs it to build its event). */
  async paymentAmount(
    providerPaymentId: string,
  ): Promise<{ amountCents: number; currency: string }> {
    const payment = await this.prisma.payment.findUnique({ where: { providerPaymentId } });
    if (!payment) throw new NotFoundException('Unknown payment.');
    return { amountCents: payment.amountCents, currency: payment.currency };
  }

  private async emptyCart(orderId: string): Promise<void> {
    try {
      const raw = await this.redis.client.get(`order-cart:${orderId}`);
      if (raw) await this.carts.clear(JSON.parse(raw) as CartOwner);
      await this.redis.client.del(`order-cart:${orderId}`);
    } catch {
      // A leftover cart is harmless; the customer can clear it.
    }
  }

  /** Abandoned checkouts: cancel orders left unpaid for a day and release their holds. */
  async cancelStaleOrders(): Promise<number> {
    const stale = await this.prisma.order.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        createdAt: { lt: new Date(Date.now() - STALE_ORDER_HOURS * 3600_000) },
      },
      include: { payments: true },
      take: 100,
    });
    for (const order of stale) {
      for (const payment of order.payments) {
        await this.gateway.cancel(payment.providerPaymentId).catch(() => undefined);
      }
      const cancelled = await this.prisma.order.updateMany({
        where: { id: order.id, status: 'PENDING_PAYMENT' },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: 'Not paid within 24 hours',
        },
      });
      if (cancelled.count) await this.releaseUnpaid(order);
    }
    return stale.length;
  }

  // ───────────── Reading orders ─────────────

  async byNumberForGuest(number: string, token: string): Promise<OrderRow> {
    const order = await this.prisma.order.findUnique({ where: { number }, include: orderInclude });
    if (!order || !verifyOrderAccessToken(this.linkSecret, order.id, token)) {
      throw new NotFoundException('We could not find that order.');
    }
    return order;
  }

  async byNumberForUser(number: string, userId: string): Promise<OrderRow> {
    const order = await this.prisma.order.findUnique({ where: { number }, include: orderInclude });
    if (!order || order.userId !== userId)
      throw new NotFoundException('We could not find that order.');
    return order;
  }

  async listForUser(userId: string): Promise<OrderSummary[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        NOT: { status: 'PENDING_PAYMENT', createdAt: { lt: new Date(Date.now() - 3600_000) } },
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return orders.map(summary);
  }

  /** A customer's view of their order, with delivery estimates and carrier scans (p10-04). */
  view(order: OrderRow): Promise<OrderView> {
    return withTracking(this.prisma, order, toOrderView(order));
  }

  // ───────────── Ops Center ─────────────

  async listForAdmin(
    query: AdminOrderListQuery,
  ): Promise<PagedResult<OrderSummary & { email: string }>> {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q.toUpperCase() } },
              { email: { contains: query.q.toLowerCase() } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return pagedResult(
      rows.map((row) => ({ ...summary(row), email: row.email })),
      total,
      query,
    );
  }

  async byIdForAdmin(id: string): Promise<OrderView> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found.');
    return toOrderView(order);
  }

  async fulfill(
    id: string,
    input: OrderFulfillment,
    actor: { user: AuthUser; meta: RequestMeta },
  ): Promise<OrderView> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { ...orderInclude, payments: true },
    });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.riskHold && (input.action === 'start' || input.action === 'ship')) {
      throw new ConflictException('This order is being reviewed. Do not ship it yet.');
    }
    const now = new Date();

    const transition = async (
      from: string[],
      data: Prisma.OrderUpdateManyMutationInput,
      event?: string,
    ) => {
      const done = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id, status: { in: from as never[] } },
          data,
        });
        if (updated.count && data.status === 'DELIVERED') await markPartsDelivered(tx, id, now);
        if (updated.count && event) {
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'order',
              aggregateId: id,
              type: event,
              payload: { number: order.number },
            },
          });
        }
        return updated.count > 0;
      });
      if (!done) {
        throw new ConflictException(
          `A ${order.status.toLowerCase().replace('_', ' ')} order can't do that.`,
        );
      }
    };

    switch (input.action) {
      case 'start':
        await transition(['PAID'], { status: 'FULFILLING', fulfillingAt: now });
        break;
      case 'ship':
        if (hasSellerItems(order)) {
          // Marketplace order: this ships NIXZORA's own items; sellers ship theirs.
          await this.prisma.$transaction((tx) =>
            settleShipment(tx, id, {
              carrier: input.carrier,
              trackingNumber: input.trackingNumber,
            }),
          );
          break;
        }
        await transition(
          ['PAID', 'FULFILLING'],
          {
            status: 'SHIPPED',
            shippedAt: now,
            fulfillingAt: order.fulfillingAt ?? now,
            trackingCarrier: input.carrier,
            trackingNumber: input.trackingNumber.toUpperCase(),
          },
          'order.shipped',
        );
        break;
      case 'deliver':
        await transition(['SHIPPED'], { status: 'DELIVERED', deliveredAt: now }, 'order.delivered');
        break;
      case 'cancel':
        await this.cancel(order, input.reason, actor.user);
        break;
    }

    await this.audit.record({
      action: `orders.${input.action === 'start' ? 'fulfilling' : input.action === 'ship' ? 'shipped' : input.action === 'deliver' ? 'delivered' : 'cancelled'}`,
      actorId: actor.user.id,
      entityType: 'order',
      entityId: id,
      meta: actor.meta,
      metadata: {
        number: order.number,
        ...(input.action === 'ship' ? { carrier: input.carrier } : {}),
        ...(input.action === 'cancel' ? { reason: input.reason } : {}),
      },
    });
    return this.byIdForAdmin(id);
  }

  /**
   * The customer cancels their own order (p10-09): within a short window after placing it, while
   * nothing is packed or shipped. Refunds in full and puts the stock back.
   */
  async customerCancel(order: OrderRow, meta?: RequestMeta): Promise<OrderView> {
    if (!cancellableUntil(order)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'NOT_CANCELLABLE',
        message:
          'This order can no longer be cancelled here. Once it arrives you can return it, or contact us now.',
      });
    }
    await assertNoSellerShipped(this.prisma, order.id);
    await this.refunds.refund(order, this.refunds.remaining(order), 'Cancelled by the customer', {
      cancel: true,
      restock: order.items
        .filter((item) => item.variantId)
        .map((item) => ({ variantId: item.variantId!, quantity: item.quantity })),
    });
    await this.audit.record({
      action: 'orders.cancelled_by_customer',
      actorId: order.userId,
      entityType: 'order',
      entityId: order.id,
      meta,
      metadata: { number: order.number },
    });
    const fresh = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
    return this.view(fresh);
  }

  /** Unpaid: cancel the payment and free the holds. Paid, not shipped: refund in full and restock. */
  private async cancel(
    order: OrderRow & {
      payments: { id: string; providerPaymentId: string; status: string; amountCents: number }[];
    },
    reason: string,
    user: AuthUser,
  ): Promise<void> {
    if (order.status === 'PENDING_PAYMENT') {
      for (const payment of order.payments) {
        await this.gateway.cancel(payment.providerPaymentId).catch(() => undefined);
      }
      const cancelled = await this.prisma.order.updateMany({
        where: { id: order.id, status: 'PENDING_PAYMENT' },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      });
      if (cancelled.count) await this.releaseUnpaid(order);
      return;
    }
    if (order.status !== 'PAID' && order.status !== 'FULFILLING') {
      throw new ConflictException('Only orders that have not shipped can be cancelled.');
    }
    if (order.trackingNumber) {
      throw new ConflictException('Part of this order has already shipped. Refund it instead.');
    }
    await assertNoSellerShipped(this.prisma, order.id);
    if (!user.permissions.includes('orders.refund')) {
      throw new ConflictException(
        'Cancelling a paid order refunds it. Ask someone who can issue refunds.',
      );
    }
    await this.refunds.refund(order, this.refunds.remaining(order), reason, {
      cancel: true,
      restock: order.items
        .filter((item) => item.variantId)
        .map((item) => ({ variantId: item.variantId!, quantity: item.quantity })),
    });
  }

  /** Goodwill or damage refund for part (or the rest) of a paid order. */
  async partialRefund(
    id: string,
    input: RefundRequest,
    actor: { user: AuthUser; meta: RequestMeta },
  ): Promise<OrderView> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found.');
    await this.refunds.refund(order, input.amountCents, input.reason, {
      restock: this.refunds.restockLines(order, input.restock),
    });
    await this.audit.record({
      action: 'orders.refunded',
      actorId: actor.user.id,
      entityType: 'order',
      entityId: id,
      meta: actor.meta,
      metadata: { number: order.number, amountCents: input.amountCents, reason: input.reason },
    });
    return this.byIdForAdmin(id);
  }
}

function summary(order: OrderRow): OrderSummary {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    totalCents: order.totalCents,
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    placedAt: order.placedAt?.toISOString() ?? null,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
  };
}
