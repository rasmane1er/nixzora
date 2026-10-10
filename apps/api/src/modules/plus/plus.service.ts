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
  type AdminPlusOverview,
  type AdminPlusQuery,
  type MyPlus,
  PLUS_GRACE_DAYS,
  PLUS_PLANS,
  PLUS_PRICE_CENTS,
  PLUS_REMIND_DAYS,
  PLUS_TRIAL_DAYS,
  type PlusJoin,
  type PlusJoinResult,
  type PlusMembershipView,
  type PlusOffer,
  type PlusPlan,
  type PlusUpdate,
} from '@nixzora/validation';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { toLocale } from '../../common/locale';
import { type RequestMeta } from '../../common/request-meta';
import { type Env } from '../../config/env';
import { type PlusMembership, type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PushService } from '../devices/push.service';
import { type AuthUser } from '../identity/auth-user';
import { MailService } from '../notifications/mail.service';
import {
  newOrderNumber,
  orderAccessToken,
  orderInclude,
  type OrderRow,
} from '../orders/order-links';
import { OrdersService } from '../orders/orders.service';
import { PaymentCardsService } from '../orders/payment-cards.service';
import { OutboxService } from '../outbox/outbox.service';
import { plusActive } from './plus-benefits.service';

const SWEEP_MS = 15 * 60_000;
const DAY_MS = 86_400_000;
const MONTHS: Record<PlusPlan, number> = { MONTHLY: 1, YEARLY: 12 };
const SYSTEM_META: RequestMeta = { ipAddress: null, userAgent: 'nixzora-plus' };
const OPEN: PlusMembership['status'][] = ['TRIALING', 'ACTIVE', 'PAST_DUE'];

/** The same day of the month `months` later (the 31st becomes the month's last day). */
export function addMonths(from: Date, months: number): Date {
  const date = new Date(from);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date;
}

/**
 * NIXZORA Plus (p10-15, ADR-0037). A fee is an order of kind PLUS, so it is paid, receipted,
 * 3-D Secured and refunded exactly like any order. Joining starts the free trial when the
 * customer has never had one; otherwise the first period is charged at once. Every 15 minutes
 * a sweep reminds members before a trial or yearly renewal, ends memberships that were
 * cancelled, and renews the rest on their saved card. A renewal that can't be charged leaves
 * the benefits on for 3 days while it is retried daily and the member can pay from a link.
 */
@Injectable()
export class PlusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlusService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly cards: PaymentCardsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    // A fee paid (now, from the pay page, or by Stripe's webhook) starts or extends the period.
    this.outbox.on('order.paid', async ({ aggregateId }) => {
      await this.activate(aggregateId);
    });
    if (!runsBackgroundJobs(this.config)) return;
    this.timer = setInterval(() => void this.sweep().catch(() => undefined), SWEEP_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ───── The member ─────

  async offer(userId?: string): Promise<PlusOffer> {
    const row = userId
      ? await this.prisma.plusMembership.findUnique({
          where: { userId },
          select: { trialUsedAt: true },
        })
      : null;
    return {
      plans: PLUS_PLANS.map((plan) => ({
        plan,
        priceCents: PLUS_PRICE_CENTS[plan],
        months: MONTHS[plan],
      })),
      currency: 'USD',
      trialDays: PLUS_TRIAL_DAYS,
      trialAvailable: userId ? !row?.trialUsedAt : null,
    };
  }

  async mine(userId: string): Promise<MyPlus> {
    const row = await this.prisma.plusMembership.findUnique({ where: { userId } });
    return {
      offer: await this.offer(userId),
      membership: row && row.status !== 'ENDED' ? await this.view(row) : null,
    };
  }

  async join(
    user: AuthUser,
    input: PlusJoin,
    meta: RequestMeta,
    locale: Locale,
  ): Promise<PlusJoinResult> {
    if (!user.permissions.includes('orders.create')) {
      throw new ForbiddenException('This account cannot buy a membership.');
    }
    const existing = await this.prisma.plusMembership.findUnique({ where: { userId: user.id } });
    if (existing && existing.status !== 'ENDED') {
      throw new ConflictException('You’re already a NIXZORA Plus member.');
    }
    const card = input.paymentCardId ? await this.cards.usable(user.id, input.paymentCardId) : null;
    const now = new Date();

    if (!existing?.trialUsedAt) {
      const data = {
        plan: input.plan,
        status: 'TRIALING' as const,
        currentPeriodEnd: new Date(now.getTime() + PLUS_TRIAL_DAYS * DAY_MS),
        cancelAtPeriodEnd: false,
        paymentCardId: card?.id ?? null,
        trialUsedAt: now,
        failedAttempts: 0,
        nextAttemptAt: null,
        remindedAt: null,
        startedAt: now,
        endedAt: null,
      };
      const row = await this.prisma.plusMembership.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...data },
        update: data,
      });
      await this.audit.record({
        action: 'plus.trial_started',
        actorId: user.id,
        entityType: 'plus_membership',
        entityId: row.id,
        meta,
        metadata: { plan: input.plan },
      });
      const view = await this.view(row);
      await this.sendMail(row, locale, 'trial', {
        date: this.date(locale, row.currentPeriodEnd),
        price: this.money(locale, PLUS_PRICE_CENTS[input.plan]),
        per: translator(locale)('email')(`plus_per_${input.plan}`),
        card: view.card
          ? `${cardBrand(view.card.brand)} •••• ${view.card.last4}`
          : translator(locale)('email')('plus_noCard'),
      });
      return { membership: view, checkout: null };
    }

    // Trial used before: the first period is charged now. Until it's paid, nothing changes.
    const row = await this.prisma.plusMembership.update({
      where: { id: existing.id },
      data: { plan: input.plan, paymentCardId: card?.id ?? null, cancelAtPeriodEnd: false },
    });
    const order = await this.feeOrder(row, user, input.plan, locale);
    const checkout = await this.orders.startPayment(order, user, {
      card,
      // A new card is kept: renewals are charged to it (said on the join page).
      saveCard: !card,
      useGiftBalance: false,
      cartOwner: null,
      meta,
      totals: this.totals(input.plan),
    });
    if (checkout.paid) await this.activate(order.id);
    await this.audit.record({
      action: 'plus.join_started',
      actorId: user.id,
      entityType: 'plus_membership',
      entityId: row.id,
      meta,
      metadata: { plan: input.plan, order: order.number, paid: checkout.paid },
    });
    const fresh = await this.prisma.plusMembership.findUniqueOrThrow({ where: { id: row.id } });
    return { membership: fresh.status === 'ENDED' ? null : await this.view(fresh), checkout };
  }

  async update(userId: string, input: PlusUpdate, meta: RequestMeta): Promise<MyPlus> {
    const row = await this.prisma.plusMembership.findUnique({ where: { userId } });
    if (!row || row.status === 'ENDED') throw new NotFoundException('You’re not a Plus member.');
    if (input.paymentCardId) await this.cards.usable(userId, input.paymentCardId);
    const leaving = input.cancelAtPeriodEnd === true && !row.cancelAtPeriodEnd;

    if (leaving && row.status === 'PAST_DUE') {
      // Nothing paid for this period: leaving ends it now.
      await this.end(row, 'Cancelled by the member while a renewal was unpaid');
    } else {
      await this.prisma.plusMembership.update({
        where: { id: row.id },
        data: {
          ...(input.plan ? { plan: input.plan } : {}),
          ...(input.cancelAtPeriodEnd !== undefined
            ? { cancelAtPeriodEnd: input.cancelAtPeriodEnd }
            : {}),
          ...(input.paymentCardId !== undefined ? { paymentCardId: input.paymentCardId } : {}),
        },
      });
      if (leaving) {
        const locale = await this.language(userId);
        await this.sendMail(row, locale, 'leaving', {
          date: this.date(locale, row.currentPeriodEnd),
        });
      }
    }
    await this.audit.record({
      action: leaving ? 'plus.cancelled' : 'plus.updated',
      actorId: userId,
      entityType: 'plus_membership',
      entityId: row.id,
      meta,
      metadata: input,
    });
    return this.mine(userId);
  }

  // ───── Fees ─────

  /** The order a fee is paid with: one line, nothing to ship, no tax (see ADR-0037). */
  private async feeOrder(
    row: PlusMembership,
    user: { id: string; email: string },
    plan: PlusPlan,
    locale: Locale,
  ): Promise<OrderRow> {
    const t = translator(locale)('email');
    const price = PLUS_PRICE_CENTS[plan];
    const name = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { firstName: true, lastName: true },
    });
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number: newOrderNumber(),
          kind: 'PLUS',
          plusMembershipId: row.id,
          userId: user.id,
          email: user.email,
          currency: 'USD',
          subtotalCents: price,
          totalCents: price,
          language: locale,
          shippingAddress: {
            fullName: [name?.firstName, name?.lastName].filter(Boolean).join(' ') || user.email,
            line1: 'NIXZORA Plus',
            city: '',
            region: '',
            postalCode: '',
            country: 'US',
          } as Prisma.InputJsonObject,
          items: {
            create: [
              {
                productTitle: 'NIXZORA Plus',
                variantTitle: t(`plus_plan_${plan}`),
                sku: `PLUS-${plan}`,
                unitPriceCents: price,
                quantity: 1,
                totalCents: price,
              },
            ],
          },
        },
        include: orderInclude,
      });
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
  }

  private totals(plan: PlusPlan) {
    const price = PLUS_PRICE_CENTS[plan];
    return {
      currency: 'USD',
      subtotalCents: price,
      discountCents: 0,
      shippingCents: 0,
      taxCents: 0,
      totalCents: price,
      freeShippingRemainingCents: 0,
    };
  }

  /**
   * A paid fee: the membership becomes active for one more period of the plan that was billed,
   * counted from the end of the current period (or from now for a new member). Safe to run
   * twice: the order moves on to DELIVERED first, and only one run can do that.
   */
  async activate(orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });
    if (!order || order.kind !== 'PLUS' || order.status !== 'PAID' || !order.plusMembershipId) {
      return false;
    }
    const plan: PlusPlan = order.items[0]?.sku === 'PLUS-YEARLY' ? 'YEARLY' : 'MONTHLY';
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: 'PAID' },
        data: { status: 'DELIVERED', fulfillingAt: now, shippedAt: now, deliveredAt: now },
      });
      if (!moved.count) return null;
      const row = await tx.plusMembership.findUniqueOrThrow({
        where: { id: order.plusMembershipId! },
      });
      const continuing =
        row.status !== 'ENDED' &&
        row.currentPeriodEnd.getTime() + PLUS_GRACE_DAYS * DAY_MS > now.getTime();
      const from = continuing ? row.currentPeriodEnd : now;
      const card = order.payments.find((p) => p.paymentCardId)?.paymentCardId ?? null;
      const updated = await tx.plusMembership.update({
        where: { id: row.id },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: addMonths(from, MONTHS[plan]),
          failedAttempts: 0,
          nextAttemptAt: null,
          remindedAt: null,
          endedAt: null,
          ...(continuing ? {} : { startedAt: now, cancelAtPeriodEnd: false }),
          ...(card && !row.paymentCardId ? { paymentCardId: card } : {}),
        },
      });
      // A renewal when an earlier fee of this stint as a member was paid; else a welcome.
      const earlier = continuing
        ? await tx.order.count({
            where: {
              plusMembershipId: row.id,
              kind: 'PLUS',
              id: { not: order.id },
              placedAt: { gte: row.startedAt },
            },
          })
        : 0;
      return { row: updated, renewed: earlier > 0 };
    });
    if (!result) return false;
    const locale = toLocale(order.language);
    const t = translator(locale)('email');
    const vars = {
      price: this.money(locale, order.totalCents),
      plan: t(`plus_plan_${plan}`),
      period: t(`plus_period_${plan}`),
      date: this.date(locale, result.row.currentPeriodEnd),
    };
    await this.sendMail(result.row, locale, result.renewed ? 'renewed' : 'joined', vars);
    return true;
  }

  // ───── The sweep ─────

  /** Reminders, endings and renewals that are due. Safe to run from several processes. */
  async sweep(now = new Date()): Promise<{ reminded: number; ended: number; charged: number }> {
    let reminded = 0;
    let ended = 0;
    let charged = 0;

    // Reminders before a trial turns paid, and before a yearly renewal (auto-renewal notice).
    const soon = new Date(now.getTime() + PLUS_REMIND_DAYS * DAY_MS);
    const remind = await this.prisma.plusMembership.findMany({
      where: {
        cancelAtPeriodEnd: false,
        remindedAt: null,
        currentPeriodEnd: { gt: now, lte: soon },
        OR: [{ status: 'TRIALING' }, { status: 'ACTIVE', plan: 'YEARLY' }],
      },
      take: 500,
    });
    for (const row of remind) {
      const won = await this.prisma.plusMembership.updateMany({
        where: { id: row.id, remindedAt: null },
        data: { remindedAt: now },
      });
      if (!won.count) continue;
      const locale = await this.language(row.userId);
      const t = translator(locale)('email');
      const view = await this.view(row);
      await this.sendMail(row, locale, 'reminder', {
        what: t(row.status === 'TRIALING' ? 'plus_reminder_trial' : 'plus_reminder_period'),
        date: this.date(locale, row.currentPeriodEnd),
        price: this.money(locale, PLUS_PRICE_CENTS[row.plan]),
        per: t(`plus_per_${row.plan}`),
        card: view.card
          ? `${cardBrand(view.card.brand)} •••• ${view.card.last4}`
          : t('plus_noCard'),
      });
      reminded++;
    }

    // Leaving members, at the end of what they had.
    const leaving = await this.prisma.plusMembership.findMany({
      where: { status: { in: OPEN }, cancelAtPeriodEnd: true, currentPeriodEnd: { lte: now } },
      take: 500,
    });
    for (const row of leaving) if (await this.end(row, 'Cancelled by the member')) ended++;

    // Renewals not paid within the grace period.
    const lapsed = await this.prisma.plusMembership.findMany({
      where: {
        status: 'PAST_DUE',
        currentPeriodEnd: { lte: new Date(now.getTime() - PLUS_GRACE_DAYS * DAY_MS) },
      },
      take: 500,
    });
    for (const row of lapsed) if (await this.end(row, 'Renewal not paid')) ended++;

    // Renewals due now, and retries (daily during the grace period).
    const due = await this.prisma.plusMembership.findMany({
      where: {
        cancelAtPeriodEnd: false,
        OR: [
          { status: { in: ['TRIALING', 'ACTIVE'] }, currentPeriodEnd: { lte: now } },
          { status: 'PAST_DUE', nextAttemptAt: { lte: now } },
        ],
      },
      take: 200,
    });
    for (const row of due) {
      // Claim it: the next try is a day away, whatever happens below.
      const won = await this.prisma.plusMembership.updateMany({
        where: { id: row.id, status: row.status, nextAttemptAt: row.nextAttemptAt },
        data: { status: 'PAST_DUE', nextAttemptAt: new Date(now.getTime() + DAY_MS) },
      });
      if (!won.count) continue;
      try {
        if (await this.renew(row)) charged++;
      } catch (error) {
        this.logger.error(`Plus renewal failed for ${row.id}: ${(error as Error).message}`);
      }
    }
    if (reminded || ended || charged) {
      this.logger.log(`Plus: ${reminded} reminded, ${ended} ended, ${charged} renewed`);
    }
    return { reminded, ended, charged };
  }

  /** Charges one renewal on the member's card; tells them how to pay when it doesn't go through. */
  private async renew(row: PlusMembership): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { id: true, email: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      await this.end(row, 'Account closed');
      return false;
    }
    // A fresh order each try: the last one's pay link is replaced by the new one.
    await this.cancelUnpaid(row.id);
    const locale = await this.language(row.userId);
    const card = await this.renewalCard(row);
    const order = await this.feeOrder(row, user, row.plan, locale);
    const result = await this.orders.startPayment(
      order,
      { id: user.id, email: user.email } as AuthUser,
      {
        card,
        saveCard: !card,
        useGiftBalance: false,
        cartOwner: null,
        meta: SYSTEM_META,
        totals: this.totals(row.plan),
        offSession: true,
      },
    );
    if (result.paid) {
      await this.activate(order.id);
      return true;
    }
    const failures = row.failedAttempts + 1;
    await this.prisma.plusMembership.update({
      where: { id: row.id },
      data: { failedAttempts: failures },
    });
    if (failures === 1) {
      // Once per renewal: the account page keeps the current pay link after that.
      const t = translator(locale)('email');
      const token = orderAccessToken(
        this.config.get('ORDER_LINK_SECRET', { infer: true }),
        order.id,
      );
      const grace = new Date(row.currentPeriodEnd.getTime() + PLUS_GRACE_DAYS * DAY_MS);
      await this.sendMail(row, locale, 'failed', {
        price: this.money(locale, order.totalCents),
        problem: result.paymentProblem ? ` (${result.paymentProblem.replace(/\.$/, '')})` : '',
        graceDate: this.date(locale, grace),
        payLink: `${this.web()}/checkout/pay/${order.number}?token=${token}`,
      });
      await this.push
        .sendToUser(row.userId, {
          title: t('push_plusFailed_title'),
          body: t('push_plusFailed_body'),
          data: { path: '/account/plus' },
        })
        .catch(() => 0);
    }
    return false;
  }

  /** The chosen card if it's still usable, else the default one; null when there is none. */
  private async renewalCard(row: PlusMembership) {
    if (row.paymentCardId) {
      const chosen = await this.cards.usable(row.userId, row.paymentCardId).catch(() => null);
      if (chosen) return chosen;
    }
    const cards = await this.cards.list(row.userId);
    const card = cards.find((c) => c.isDefault && !c.expired) ?? cards.find((c) => !c.expired);
    return card ? this.cards.usable(row.userId, card.id).catch(() => null) : null;
  }

  private async cancelUnpaid(membershipId: string): Promise<void> {
    await this.prisma.order.updateMany({
      where: { plusMembershipId: membershipId, kind: 'PLUS', status: 'PENDING_PAYMENT' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Replaced by a newer Plus renewal',
      },
    });
  }

  private async end(row: PlusMembership, reason: string): Promise<boolean> {
    const now = new Date();
    const done = await this.prisma.plusMembership.updateMany({
      where: { id: row.id, status: { in: OPEN } },
      data: { status: 'ENDED', endedAt: now, nextAttemptAt: null },
    });
    if (!done.count) return false;
    await this.cancelUnpaid(row.id);
    await this.audit.record({
      action: 'plus.ended',
      actorId: null,
      entityType: 'plus_membership',
      entityId: row.id,
      metadata: { reason },
    });
    const locale = await this.language(row.userId);
    await this.sendMail(row, locale, 'ended', { date: this.date(locale, now) });
    return true;
  }

  // ───── Ops ─────

  async overview(query: AdminPlusQuery): Promise<AdminPlusOverview> {
    const [grouped, paying, leaving, rows] = await Promise.all([
      this.prisma.plusMembership.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.plusMembership.groupBy({
        by: ['plan'],
        where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
        _count: { _all: true },
      }),
      this.prisma.plusMembership.count({
        where: { status: { in: OPEN }, cancelAtPeriodEnd: true },
      }),
      this.prisma.plusMembership.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.q
            ? {
                user: {
                  OR: [
                    { email: { contains: query.q, mode: 'insensitive' } },
                    { firstName: { contains: query.q, mode: 'insensitive' } },
                    { lastName: { contains: query.q, mode: 'insensitive' } },
                  ],
                },
              }
            : {}),
        },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
    ]);
    const counts = { TRIALING: 0, ACTIVE: 0, PAST_DUE: 0, ENDED: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;
    const mrrCents = paying.reduce(
      (sum, g) => sum + Math.round((PLUS_PRICE_CENTS[g.plan] / MONTHS[g.plan]) * g._count._all),
      0,
    );
    return {
      counts,
      mrrCents,
      leaving,
      members: rows.map((row) => ({
        userId: row.userId,
        email: row.user.email,
        name: [row.user.firstName, row.user.lastName].filter(Boolean).join(' '),
        plan: row.plan,
        status: row.status,
        currentPeriodEnd: row.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        failedAttempts: row.failedAttempts,
        startedAt: row.startedAt.toISOString(),
      })),
    };
  }

  /** Support ends a membership now (no refund here: refund the fee's order if one is owed). */
  async endByStaff(userId: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    const row = await this.prisma.plusMembership.findUnique({ where: { userId } });
    if (!row || row.status === 'ENDED') throw new NotFoundException('No open membership.');
    await this.end(row, 'Ended by support');
    await this.audit.record({
      action: 'plus.ended_by_staff',
      actorId: actor.id,
      entityType: 'plus_membership',
      entityId: row.id,
      meta,
    });
  }

  // ───── Helpers ─────

  private async view(row: PlusMembership): Promise<PlusMembershipView> {
    const [card, unpaid, saved] = await Promise.all([
      this.renewalCard(row),
      this.prisma.order.findFirst({
        where: { plusMembershipId: row.id, kind: 'PLUS', status: 'PENDING_PAYMENT' },
        orderBy: { createdAt: 'desc' },
        select: { number: true },
      }),
      this.prisma.order.aggregate({
        where: {
          userId: row.userId,
          kind: 'GOODS',
          status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
        },
        _sum: { plusSavingsCents: true },
      }),
    ]);
    const renewing = row.status !== 'ENDED' && !row.cancelAtPeriodEnd;
    return {
      plan: row.plan,
      status: row.status,
      active: plusActive(row),
      currentPeriodEnd: row.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      trial: row.status === 'TRIALING',
      nextCharge: renewing
        ? {
            amountCents: PLUS_PRICE_CENTS[row.plan],
            at: (row.status === 'PAST_DUE' && row.nextAttemptAt
              ? row.nextAttemptAt
              : row.currentPeriodEnd
            ).toISOString(),
          }
        : null,
      card: card ? { id: card.id, brand: card.brand, last4: card.last4 } : null,
      unpaidOrderNumber: unpaid?.number ?? null,
      savedCents: saved._sum.plusSavingsCents ?? 0,
      memberSince: row.startedAt.toISOString(),
    };
  }

  private async sendMail(
    row: { userId: string },
    locale: Locale,
    kind: 'trial' | 'joined' | 'renewed' | 'reminder' | 'failed' | 'ended' | 'leaving',
    vars: Record<string, string>,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { email: true },
    });
    if (!user) return;
    const t = translator(locale)('email');
    const link = `${this.web()}/account/plus`;
    const all = { ...vars, link };
    await this.mail.trySend({
      to: user.email,
      subject: t(`plus_${kind}_subject`, all),
      text: t(`plus_${kind}_text`, all),
      template: `plus.${kind}`,
      data: { link },
    });
  }

  private async language(userId: string): Promise<Locale> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    return toLocale(user?.language ?? 'en');
  }

  private money(locale: Locale, cents: number): string {
    return formatters(locale).money(cents);
  }

  private date(locale: Locale, at: Date): string {
    return formatters(locale).date(at.toISOString());
  }

  private web(): string {
    return this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
  }
}
