import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cardBrand, formatters, type Locale, translator } from '@nixzora/i18n';
import {
  type Address,
  type CheckoutResponse,
  type SubscribeResult,
  type SubscriptionCreate,
  SUBSCRIPTION_MAX_FAILURES,
  type SubscriptionUpdate,
  type SubscriptionView,
  SUBSCRIBE_PERCENT,
  subscribePercent,
} from '@nixzora/validation';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { toLocale } from '../../common/locale';
import { type RequestMeta } from '../../common/request-meta';
import { type Env } from '../../config/env';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CartService } from '../cart/cart.service';
import { StorageService } from '../media/storage.service';
import { PushService } from '../devices/push.service';
import { type AuthUser } from '../identity/auth-user';
import { MailService } from '../notifications/mail.service';
import { orderAccessToken } from '../orders/order-links';
import { OrdersService } from '../orders/orders.service';
import { PaymentCardsService } from '../orders/payment-cards.service';

const SWEEP_MS = 15 * 60_000;
const DAY_MS = 86_400_000;

const include = {
  product: {
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      sellerId: true,
      subscribable: true,
      images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
      variants: { select: { id: true, title: true, priceCents: true, isActive: true } },
    },
  },
} satisfies Prisma.SubscriptionInclude;
type Row = Prisma.SubscriptionGetPayload<{ include: typeof include }>;

const SYSTEM_META: RequestMeta = { ipAddress: null, userAgent: 'subscribe-and-save' };

/**
 * Subscribe & Save (p10-11). Subscribing places the first delivery at once with the customer's
 * default saved card (ADR-0031) and address. After that a sweep orders what is due: every due
 * subscription of a customer (same card and address) goes out as one order, at 5% off, or 10%
 * with 3 or more in it, charged while the customer is away. A declined charge leaves the order
 * waiting with a link to pay; three in a row pause the subscriptions.
 */
@Injectable()
export class SubscriptionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly cards: PaymentCardsService,
    private readonly carts: CartService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (!runsBackgroundJobs(this.config)) return;
    this.timer = setInterval(() => void this.sweep().catch(() => undefined), SWEEP_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ───── The customer's subscriptions ─────

  async list(userId: string): Promise<SubscriptionView[]> {
    const rows = await this.prisma.subscription.findMany({
      where: { userId, status: { not: 'CANCELLED' } },
      include,
      orderBy: { createdAt: 'desc' },
    });
    return this.views(rows);
  }

  async subscribe(
    user: AuthUser,
    input: SubscriptionCreate,
    meta: RequestMeta,
    locale: Locale,
  ): Promise<SubscribeResult> {
    if (!user.permissions.includes('orders.create')) {
      throw new ForbiddenException('This account cannot place orders.');
    }
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: input.variantId },
      select: {
        id: true,
        isActive: true,
        product: { select: { id: true, status: true, sellerId: true, subscribable: true } },
      },
    });
    const product = variant?.product;
    if (!variant?.isActive || product?.status !== 'ACTIVE') {
      throw new NotFoundException('That product is not available.');
    }
    if (product.sellerId !== null && !product.subscribable) {
      throw new ConflictException('This product isn’t available with Subscribe & Save.');
    }
    const existing = await this.prisma.subscription.findFirst({
      where: { userId: user.id, variantId: variant.id, status: { not: 'CANCELLED' } },
    });
    if (existing) {
      throw new ConflictException('You already subscribe to this. Change it under Subscriptions.');
    }
    const setup = await this.setup(user.id);
    if (!setup) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SUBSCRIBE_SETUP',
        message:
          'Subscribe & Save charges a saved card. Buy once and tick “Save this card”, and keep an address in your address book.',
      });
    }
    const row = await this.prisma.subscription.create({
      data: {
        userId: user.id,
        productId: product.id,
        variantId: variant.id,
        quantity: input.quantity,
        intervalDays: input.intervalDays,
        nextOrderAt: new Date(Date.now() + input.intervalDays * DAY_MS),
        shippingAddress: setup.address as Prisma.InputJsonObject,
        paymentCardId: setup.cardId,
      },
      include,
    });
    await this.audit.record({
      action: 'subscriptions.created',
      actorId: user.id,
      entityType: 'subscription',
      entityId: row.id,
      meta,
      metadata: { variantId: variant.id, intervalDays: input.intervalDays },
    });
    // The first delivery goes now, with the customer here (3-D Secure possible).
    const order = await this.deliver(user, [row], { offSession: false, meta, locale }).catch(
      async (error: Error) => {
        await this.prisma.subscription.delete({ where: { id: row.id } });
        throw error;
      },
    );
    const [view] = await this.views([
      await this.prisma.subscription.findUniqueOrThrow({ where: { id: row.id }, include }),
    ]);
    await this.confirm(user, view!, locale);
    return { subscription: view!, order };
  }

  async update(userId: string, id: string, input: SubscriptionUpdate): Promise<SubscriptionView> {
    const row = await this.own(userId, id);
    if (row.status === 'CANCELLED') throw new ConflictException('This subscription was cancelled.');
    if (input.paymentCardId) await this.cards.usable(userId, input.paymentCardId);
    const interval = input.intervalDays ?? row.intervalDays;
    let next = row.nextOrderAt;
    if (input.skipNext) next = new Date(next.getTime() + interval * DAY_MS);
    // Resuming after a long pause: the next delivery is one interval from today at the latest.
    if (input.status === 'ACTIVE' && row.status === 'PAUSED' && next < new Date()) {
      next = new Date(Date.now() + DAY_MS);
    }
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        ...(input.quantity ? { quantity: input.quantity } : {}),
        ...(input.intervalDays ? { intervalDays: input.intervalDays } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.status === 'ACTIVE' ? { failures: 0 } : {}),
        ...(input.paymentCardId ? { paymentCardId: input.paymentCardId, failures: 0 } : {}),
        nextOrderAt: next,
      },
      include,
    });
    return (await this.views([updated]))[0]!;
  }

  async cancel(userId: string, id: string): Promise<void> {
    await this.own(userId, id);
    await this.prisma.subscription.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit.record({
      action: 'subscriptions.cancelled',
      actorId: userId,
      entityType: 'subscription',
      entityId: id,
    });
  }

  /** A store turns Subscribe & Save on or off for one of its listings. */
  async setSubscribable(sellerId: string, productId: string, allowed: boolean): Promise<boolean> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, sellerId } });
    if (!product) throw new NotFoundException('Listing not found.');
    await this.prisma.product.update({ where: { id: productId }, data: { subscribable: allowed } });
    if (!allowed) {
      // Customers keep nothing they can no longer get: their subscriptions stop.
      await this.prisma.subscription.updateMany({
        where: { productId, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED' },
      });
    }
    return allowed;
  }

  // ───── Deliveries ─────

  /** Orders everything due. Safe to run from several processes: each row is claimed first. */
  async sweep(now = new Date()): Promise<number> {
    const due = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', nextOrderAt: { lte: now } },
      include,
      orderBy: { nextOrderAt: 'asc' },
      take: 500,
    });
    // One order per customer, card and address.
    const groups = new Map<string, Row[]>();
    for (const row of due) {
      const key = `${row.userId}|${row.paymentCardId}|${JSON.stringify(row.shippingAddress)}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    let placed = 0;
    for (const rows of groups.values()) {
      // Claim: move each on by its interval; a row another process moved first is skipped.
      const claimed: Row[] = [];
      for (const row of rows) {
        const next = new Date(
          Math.max(row.nextOrderAt.getTime() + row.intervalDays * DAY_MS, now.getTime() + DAY_MS),
        );
        const won = await this.prisma.subscription.updateMany({
          where: { id: row.id, status: 'ACTIVE', nextOrderAt: row.nextOrderAt },
          data: { nextOrderAt: next },
        });
        if (won.count) claimed.push({ ...row, nextOrderAt: next });
      }
      if (!claimed.length) continue;
      const user = await this.authUser(claimed[0]!.userId);
      if (!user) continue;
      try {
        await this.deliver(user, claimed, { offSession: true, meta: SYSTEM_META });
        placed++;
      } catch (error) {
        await this.skipped(user, claimed, (error as Error).message);
      }
    }
    if (placed) this.logger.log(`Subscribe & Save: ${placed} deliveries ordered`);
    return placed;
  }

  /**
   * One order for these subscriptions, at the delivery's discount, on their saved card. Records
   * the outcome on each: paid resets the failure count; a declined charge counts one and tells
   * the customer (three in a row pause them).
   */
  private async deliver(
    user: AuthUser,
    rows: Row[],
    options: { offSession: boolean; meta: RequestMeta; locale?: Locale },
  ): Promise<CheckoutResponse> {
    const first = rows[0]!;
    const card = first.paymentCardId ? await this.cards.usable(user.id, first.paymentCardId) : null;
    if (!card) throw new ConflictException('The card for these subscriptions was removed.');
    const cart = await this.carts.buyNowMany(
      rows.map((row) => ({ variantId: row.variantId, quantity: row.quantity })),
    );
    const language = await this.language(user.id);
    const result = await this.orders.checkout(
      {
        buyNowId: cart.cartId!,
        email: user.email,
        shippingAddress: first.shippingAddress as Address,
        paymentCardId: card.id,
        useGiftBalance: true,
      },
      user,
      options.meta,
      options.locale ?? language,
      {
        percentOff: subscribePercent(rows.length),
        byVariant: new Map(rows.map((row) => [row.variantId, row.id])),
        offSession: options.offSession,
      },
    );
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { number: result.orderNumber },
      select: { id: true },
    });
    const failed = !result.paid && Boolean(result.paymentProblem);
    for (const row of rows) {
      const failures = failed ? row.failures + 1 : 0;
      await this.prisma.subscription.update({
        where: { id: row.id },
        data: {
          lastOrderId: order.id,
          failures,
          ...(failures >= SUBSCRIPTION_MAX_FAILURES ? { status: 'PAUSED' } : {}),
        },
      });
    }
    if (failed && options.offSession) {
      await this.declined(user, rows, result);
    }
    return result;
  }

  private async declined(user: AuthUser, rows: Row[], result: CheckoutResponse) {
    const locale = await this.language(user.id);
    const t = translator(locale)('email');
    const web = this.web();
    const items = rows.map((r) => r.product.title).join(', ');
    const token = orderAccessToken(
      this.config.get('ORDER_LINK_SECRET', { infer: true }),
      result.orderId,
    );
    const vars = {
      number: result.orderNumber,
      items,
      problem: result.paymentProblem ?? '',
      payLink: `${web}/checkout/pay/${result.orderNumber}?token=${token}`,
      subsLink: `${web}/account/subscriptions`,
    };
    await this.push
      .sendToUser(user.id, {
        title: t('push_subFailed_title'),
        body: t('push_subFailed_body', vars),
        data: { path: `/orders/${result.orderNumber}` },
      })
      .catch(() => 0);
    await this.mail.trySend({
      to: user.email,
      subject: t('sub_failed_subject'),
      text: t('sub_failed_text', vars),
      template: 'subscriptions.charge-failed',
      data: { number: result.orderNumber, link: vars.payLink },
    });
    const paused = rows.filter((r) => r.failures + 1 >= SUBSCRIPTION_MAX_FAILURES);
    if (paused.length) {
      await this.mail.trySend({
        to: user.email,
        subject: t('sub_paused_subject'),
        text: t('sub_paused_text', {
          count: SUBSCRIPTION_MAX_FAILURES,
          items: paused.map((r) => r.product.title).join(', '),
          subsLink: vars.subsLink,
        }),
        template: 'subscriptions.paused',
        data: { link: vars.subsLink },
      });
    }
  }

  /** The auto-renewal terms, in writing, with how to cancel. */
  private async confirm(user: AuthUser, view: SubscriptionView, locale: Locale) {
    const t = translator(locale)('email');
    const s = translator(locale)('subscribe');
    const f = formatters(locale);
    const vars = {
      item: view.product.title,
      quantity: view.quantity,
      interval: s(`interval_${view.intervalDays as 14 | 30 | 60 | 90}`),
      percent: f.percent(SUBSCRIBE_PERCENT / 100),
      card: view.card ? `${cardBrand(view.card.brand)} •••• ${view.card.last4}` : '',
      date: view.nextOrderAt ? f.date(view.nextOrderAt) : '',
      subsLink: `${this.web()}/account/subscriptions`,
    };
    await this.mail.trySend({
      to: user.email,
      subject: t('sub_created_subject', vars),
      text: t('sub_created_text', vars),
      template: 'subscriptions.created',
      data: { item: view.product.title, link: vars.subsLink },
    });
  }

  /** Nothing could be ordered (sold out, removed card…): tell the customer, try next time. */
  private async skipped(user: AuthUser, rows: Row[], reason: string) {
    this.logger.warn(`Subscribe & Save delivery skipped: ${reason}`);
    const locale = await this.language(user.id);
    const t = translator(locale)('email');
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
      rows[0]!.nextOrderAt,
    );
    await this.mail.trySend({
      to: user.email,
      subject: t('sub_skipped_subject'),
      text: t('sub_skipped_text', {
        items: rows.map((r) => r.product.title).join(', '),
        reason,
        date,
        subsLink: `${this.web()}/account/subscriptions`,
      }),
      template: 'subscriptions.skipped',
      data: { reason },
    });
  }

  // ───── Helpers ─────

  /** The default saved card and address, or null when either is missing. */
  private async setup(userId: string): Promise<{ cardId: string; address: Address } | null> {
    const cards = await this.cards.list(userId);
    const card = cards.find((c) => c.isDefault && !c.expired) ?? cards.find((c) => !c.expired);
    const address = await this.prisma.address.findFirst({
      where: { userId },
      orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }],
    });
    if (!card || !address) return null;
    return {
      cardId: card.id,
      address: {
        fullName: address.fullName,
        line1: address.line1,
        line2: address.line2 ?? undefined,
        city: address.city,
        region: address.region as Address['region'],
        postalCode: address.postalCode,
        country: 'US',
        phone: address.phone ?? undefined,
      },
    };
  }

  private async own(userId: string, id: string): Promise<Row> {
    const row = await this.prisma.subscription.findFirst({ where: { id, userId }, include });
    if (!row) throw new NotFoundException('Subscription not found.');
    return row;
  }

  private async authUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });
    if (!user || user.status !== 'ACTIVE') return null;
    const permissions = new Set(
      user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)),
    );
    return {
      id: user.id,
      email: user.email,
      sessionId: 'subscribe-and-save',
      roles: user.roles.map((r) => r.role.key),
      permissions: [...permissions],
      mfaEnabled: user.mfaEnabled,
      mfaVerified: false,
    };
  }

  private async language(userId: string): Promise<Locale> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    return toLocale(user?.language ?? 'en');
  }

  private web(): string {
    return this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
  }

  private async views(rows: Row[]): Promise<SubscriptionView[]> {
    const cardIds = rows.map((r) => r.paymentCardId).filter((id): id is string => Boolean(id));
    const cards = new Map(
      (await this.prisma.paymentCard.findMany({ where: { id: { in: cardIds } } })).map((c) => [
        c.id,
        c,
      ]),
    );
    const lastIds = rows.map((r) => r.lastOrderId).filter((id): id is string => Boolean(id));
    const orders = new Map(
      (
        await this.prisma.order.findMany({
          where: { id: { in: lastIds } },
          select: { id: true, number: true },
        })
      ).map((o) => [o.id, o.number]),
    );
    return rows.map((row) => {
      const variant = row.product.variants.find((v) => v.id === row.variantId);
      const card = row.paymentCardId ? cards.get(row.paymentCardId) : undefined;
      const address = row.shippingAddress as Address;
      const image = row.product.images[0];
      return {
        id: row.id,
        product: {
          id: row.product.id,
          slug: row.product.slug,
          title: row.product.title,
          imageUrl: image ? this.storage.publicUrl(image.storageKey) : null,
        },
        variantTitle: variant?.title ?? '',
        quantity: row.quantity,
        intervalDays: row.intervalDays,
        nextOrderAt: row.status === 'CANCELLED' ? null : row.nextOrderAt.toISOString(),
        status: row.status,
        unitPriceCents: variant?.priceCents ?? 0,
        card: card ? { brand: card.brand, last4: card.last4 } : null,
        shipTo: `${address.fullName}, ${address.city}`,
        failures: row.failures,
        lastOrderNumber: row.lastOrderId ? (orders.get(row.lastOrderId) ?? null) : null,
      };
    });
  }
}
