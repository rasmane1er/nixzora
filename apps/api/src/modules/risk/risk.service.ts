import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AdminRiskQuery,
  type PagedResult,
  type RiskAssessmentView,
  type RiskReview,
  type RiskSignal,
} from '@nixzora/validation';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { type Env } from '../../config/env';
import { type Prisma, type RiskAssessment, type RiskSubject } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payments/payment-gateway';
import {
  checkoutSignals,
  type Decision,
  decide,
  isDisposableEmail,
  isPublicIp,
  paymentRiskSignal,
  payoutSignals,
  scoreOf,
} from './risk-rules';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Allowed checkouts are kept this long: long enough for velocity and look-back rules. */
const KEEP_ALLOWED_DAYS = 90;
const LIVE_ORDER = ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED'] as const;

export type CheckoutAssessment = {
  score: number;
  decision: Decision;
  signals: RiskSignal[];
  enforced: boolean;
  email: string;
  userId: string | null;
  ipAddress: string | null;
  amountCents: number;
};

const viewInclude = {
  order: {
    select: { id: true, number: true, status: true, email: true, riskHold: true, currency: true },
  },
  seller: { select: { id: true, handle: true, displayName: true, payoutsHeld: true } },
  reviewedBy: { select: { email: true } },
} satisfies Prisma.RiskAssessmentInclude;
type ViewRow = Prisma.RiskAssessmentGetPayload<{ include: typeof viewInclude }>;

/**
 * Fraud signals on checkout and payouts (ADR-0024). Gathers the facts, scores them with the
 * rules in risk-rules.ts and records every decision. In "enforce" mode a checkout over the block
 * score is declined, and orders or payouts over the review score wait for a person.
 */
@Injectable()
export class RiskService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RiskService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  onModuleInit(): void {
    if (!runsBackgroundJobs(this.config)) return;
    this.timer = setInterval(() => void this.purge().catch(() => undefined), DAY);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  get mode(): Env['RISK_CHECKS'] {
    return this.config.get('RISK_CHECKS', { infer: true });
  }

  private get thresholds() {
    return {
      review: this.config.get('RISK_REVIEW_SCORE', { infer: true }),
      block: this.config.get('RISK_BLOCK_SCORE', { infer: true }),
    };
  }

  // ───────────── Checkout ─────────────

  async assessCheckout(input: {
    email: string;
    userId: string | null;
    ipAddress: string | null;
    totalCents: number;
    quantities: number[];
  }): Promise<CheckoutAssessment | null> {
    if (this.mode === 'off') return null;
    const email = input.email.trim().toLowerCase();
    const ip = input.ipAddress;
    const ipKnown = isPublicIp(ip);
    const now = Date.now();
    const hourAgo = new Date(now - HOUR);
    const dayAgo = new Date(now - DAY);

    const [user, history, fromIp, fromEmail, ipEmails, failed, priorFraud] = await Promise.all([
      input.userId
        ? this.prisma.user.findUnique({ where: { id: input.userId }, select: { createdAt: true } })
        : null,
      input.userId
        ? this.prisma.order.aggregate({
            where: {
              userId: input.userId,
              status: { in: [...LIVE_ORDER] },
              riskAssessments: { none: { status: 'CONFIRMED' } },
            },
            _count: true,
            _avg: { totalCents: true },
          })
        : null,
      ipKnown
        ? this.prisma.riskAssessment.count({
            where: { subject: 'CHECKOUT', ipAddress: ip, createdAt: { gt: hourAgo } },
          })
        : 0,
      this.prisma.riskAssessment.count({
        where: { subject: 'CHECKOUT', email, createdAt: { gt: hourAgo } },
      }),
      ipKnown
        ? this.prisma.riskAssessment.groupBy({
            by: ['email'],
            where: { subject: 'CHECKOUT', ipAddress: ip, createdAt: { gt: dayAgo } },
          })
        : [],
      this.prisma.payment.count({
        where: {
          status: 'FAILED',
          updatedAt: { gt: dayAgo },
          order: {
            OR: [
              { email: { equals: email, mode: 'insensitive' } },
              ...(ipKnown
                ? [{ riskAssessments: { some: { ipAddress: ip, createdAt: { gt: dayAgo } } } }]
                : []),
            ],
          },
        },
      }),
      this.prisma.riskAssessment.count({
        where: {
          status: 'CONFIRMED',
          subject: { in: ['CHECKOUT', 'CHARGEBACK'] },
          OR: [
            { email },
            ...(input.userId ? [{ userId: input.userId }] : []),
            ...(ipKnown ? [{ ipAddress: ip }] : []),
          ],
        },
      }),
    ]);

    const emails = new Set(ipEmails.map((row) => row.email).filter(Boolean));
    emails.add(email);
    const signals = checkoutSignals({
      totalCents: input.totalCents,
      accountAgeHours: user ? (now - user.createdAt.getTime()) / HOUR : null,
      paidOrders: history?._count ?? 0,
      averagePaidCents: Math.round(history?._avg.totalCents ?? 0),
      ipKnown,
      checkoutsFromIp1h: fromIp,
      checkoutsFromEmail1h: fromEmail,
      emailsFromIp24h: ipKnown ? emails.size : 0,
      failedPayments24h: failed,
      priorFraud: priorFraud > 0,
      maxLineQuantity: Math.max(0, ...input.quantities),
      disposableEmail: isDisposableEmail(email),
    });
    const score = scoreOf(signals);
    return {
      score,
      decision: decide(score, this.thresholds),
      signals,
      enforced: this.mode === 'enforce',
      email,
      userId: input.userId,
      ipAddress: ip,
      amountCents: input.totalCents,
    };
  }

  /** Records the assessment; with an order when one was created (not for declined checkouts). */
  async recordCheckout(
    assessment: CheckoutAssessment,
    orderId: string | null,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const review = assessment.decision === 'REVIEW' && assessment.enforced && orderId;
    const row = await tx.riskAssessment.create({
      data: {
        subject: 'CHECKOUT',
        orderId,
        userId: assessment.userId,
        email: assessment.email,
        ipAddress: assessment.ipAddress,
        amountCents: assessment.amountCents,
        score: assessment.score,
        decision: assessment.decision,
        signals: assessment.signals as Prisma.InputJsonArray,
        enforced: assessment.enforced,
        status: review ? 'OPEN' : null,
      },
    });
    if (assessment.decision !== 'ALLOW') {
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'risk',
          aggregateId: row.id,
          type: assessment.decision === 'BLOCK' ? 'risk.checkout_declined' : 'risk.review_opened',
          payload: { subject: 'CHECKOUT', score: assessment.score, enforced: assessment.enforced },
        },
      });
    }
  }

  /**
   * After a card payment succeeds: adds the provider's fraud verdict (Stripe Radar). A risky
   * card can push an allowed order into review; it is then held before anyone ships it.
   */
  async afterPayment(orderId: string, providerPaymentId: string): Promise<void> {
    if (this.mode === 'off' || !this.gateway.paymentRisk) return;
    let level: string | null;
    try {
      level = await this.gateway.paymentRisk(providerPaymentId);
    } catch (error) {
      this.logger.warn(`No payment risk for ${providerPaymentId}: ${(error as Error).message}`);
      return;
    }
    const signal = paymentRiskSignal(level);
    if (!signal) return;
    const latest = await this.prisma.riskAssessment.findFirst({
      where: { orderId, subject: 'CHECKOUT' },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) return;
    const signals = [
      ...(latest.signals as RiskSignal[]).filter((s) => !s.code.startsWith('radar_')),
      signal,
    ];
    const score = scoreOf(signals);
    // A paid order is never declined after the fact: the worst outcome is a review.
    const decision: Decision = decide(score, this.thresholds) === 'ALLOW' ? 'ALLOW' : 'REVIEW';
    const opens = decision === 'REVIEW' && latest.enforced && latest.status === null;
    await this.prisma.$transaction(async (tx) => {
      await tx.riskAssessment.update({
        where: { id: latest.id },
        data: {
          signals: signals as Prisma.InputJsonArray,
          score,
          decision,
          ...(opens ? { status: 'OPEN' } : {}),
        },
      });
      if (opens) {
        await tx.order.update({ where: { id: orderId }, data: { riskHold: true } });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'risk',
            aggregateId: latest.id,
            type: 'risk.review_opened',
            payload: { subject: 'CHECKOUT', score, enforced: true },
          },
        });
      }
    });
  }

  // ───────────── Chargebacks ─────────────

  /**
   * A card holder disputed a payment: the order goes to review (answer the dispute), and every
   * store that sold part of it stops being paid until someone looks at the store.
   */
  async onDispute(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        email: true,
        userId: true,
        totalCents: true,
        sellerOrders: { select: { sellerId: true } },
        riskAssessments: {
          where: { subject: 'CHECKOUT' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { ipAddress: true },
        },
      },
    });
    if (!order) return;
    const enforced = this.mode === 'enforce';
    await this.prisma.riskAssessment.create({
      data: {
        subject: 'CHARGEBACK',
        orderId,
        userId: order.userId,
        email: order.email.toLowerCase(),
        ipAddress: order.riskAssessments[0]?.ipAddress ?? null,
        amountCents: order.totalCents,
        score: 100,
        decision: 'REVIEW',
        signals: [{ code: 'chargeback', points: 100 }] as Prisma.InputJsonArray,
        enforced,
        status: 'OPEN',
      },
    });
    for (const { sellerId } of order.sellerOrders) {
      await this.holdPayouts(sellerId, null, true);
    }
  }

  // ───────────── Payouts ─────────────

  /**
   * Called before a store is paid. Returns true when payouts are (now) on hold. A store whose
   * review was cleared in the last 30 days is not held again for the same or a lower score.
   */
  async checkPayout(sellerId: string, amountCents: number): Promise<boolean> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { payoutsHeld: true },
    });
    if (seller?.payoutsHeld && this.mode === 'enforce') return true;
    if (this.mode === 'off') return false;
    return this.holdPayouts(sellerId, amountCents, false);
  }

  private async holdPayouts(
    sellerId: string,
    amountCents: number | null,
    always: boolean,
  ): Promise<boolean> {
    const signals = payoutSignals(await this.payoutFacts(sellerId, amountCents ?? 0));
    const score = scoreOf(signals);
    const decision: Decision =
      always || decide(score, this.thresholds) !== 'ALLOW' ? 'REVIEW' : 'ALLOW';
    if (decision === 'ALLOW') return false;
    if (!always) {
      const cleared = await this.prisma.riskAssessment.findFirst({
        where: {
          sellerId,
          subject: 'PAYOUT',
          status: 'CLEARED',
          reviewedAt: { gt: new Date(Date.now() - 30 * DAY) },
          score: { gte: score },
        },
      });
      if (cleared) return false;
    }
    const enforced = this.mode === 'enforce';
    const open = await this.prisma.riskAssessment.findFirst({
      where: { sellerId, subject: 'PAYOUT', status: 'OPEN' },
    });
    await this.prisma.$transaction(async (tx) => {
      if (open) {
        // One open review per store: refresh it instead of piling up.
        await tx.riskAssessment.update({
          where: { id: open.id },
          data: { signals: signals as Prisma.InputJsonArray, score, amountCents },
        });
      } else {
        const created = await tx.riskAssessment.create({
          data: {
            subject: 'PAYOUT',
            sellerId,
            amountCents,
            score,
            decision,
            signals: signals as Prisma.InputJsonArray,
            enforced,
            status: enforced ? 'OPEN' : null,
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'risk',
            aggregateId: created.id,
            type: 'risk.review_opened',
            payload: { subject: 'PAYOUT', score, enforced },
          },
        });
      }
      if (enforced) {
        await tx.seller.update({ where: { id: sellerId }, data: { payoutsHeld: true } });
      }
    });
    return enforced;
  }

  private async payoutFacts(sellerId: string, amountCents: number) {
    const now = Date.now();
    const since = (days: number) => new Date(now - days * DAY);
    const [seller, orders30d, refunded30d, weekly, self, chargebacks, fraud] = await Promise.all([
      this.prisma.seller.findUnique({
        where: { id: sellerId },
        select: { approvedAt: true, createdAt: true },
      }),
      this.prisma.sellerOrder.count({ where: { sellerId, createdAt: { gt: since(30) } } }),
      this.prisma.sellerOrder.count({
        where: {
          sellerId,
          createdAt: { gt: since(30) },
          OR: [{ status: 'CANCELLED' }, { refundedCents: { gt: 0 } }],
        },
      }),
      this.prisma.$queryRaw<{ week: number; cents: bigint }[]>`
        SELECT floor(extract(epoch FROM (now() - created_at)) / 604800)::int AS week,
               sum(items_cents)::bigint AS cents
        FROM seller_orders
        WHERE seller_id = ${sellerId}::uuid AND status <> 'CANCELLED'
          AND created_at > now() - interval '63 days'
        GROUP BY 1`,
      this.prisma.sellerOrder.count({
        where: {
          sellerId,
          order: {
            OR: [
              { user: { sellerMembership: { sellerId } } },
              ...(await this.memberEmails(sellerId)).map((email) => ({
                email: { equals: email, mode: 'insensitive' as const },
              })),
            ],
          },
        },
      }),
      this.prisma.payment.count({
        where: {
          disputedAt: { gt: since(90) },
          order: { sellerOrders: { some: { sellerId } } },
        },
      }),
      this.prisma.sellerOrder.count({
        where: {
          sellerId,
          createdAt: { gt: since(90) },
          order: { riskAssessments: { some: { status: 'CONFIRMED', subject: 'CHECKOUT' } } },
        },
      }),
    ]);
    const byWeek = new Map(weekly.map((row) => [row.week, Number(row.cents)]));
    const ageDays = (now - (seller?.approvedAt ?? seller?.createdAt ?? new Date()).getTime()) / DAY;
    const weeksOfHistory = Math.min(8, Math.max(0, Math.floor(ageDays / 7) - 1));
    let prior = 0;
    for (let week = 1; week <= 8; week++) prior += byWeek.get(week) ?? 0;
    return {
      amountCents,
      storeAgeDays: ageDays,
      sellerOrders30d: orders30d,
      refundedOrders30d: refunded30d,
      sales7dCents: byWeek.get(0) ?? 0,
      averageWeeklyCents: weeksOfHistory ? Math.round(prior / weeksOfHistory) : 0,
      weeksOfHistory,
      selfPurchases: self,
      chargebacks90d: chargebacks,
      fraudOrders90d: fraud,
    };
  }

  private async memberEmails(sellerId: string): Promise<string[]> {
    const members = await this.prisma.sellerMember.findMany({
      where: { sellerId },
      select: { user: { select: { email: true } } },
    });
    return members.map((member) => member.user.email);
  }

  // ───────────── Review (Ops Center) ─────────────

  async list(query: AdminRiskQuery, pageSize = 25): Promise<PagedResult<RiskAssessmentView>> {
    const where: Prisma.RiskAssessmentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.decision ? { decision: query.decision } : {}),
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      // Nothing to do until a held order is paid (unpaid ones are cancelled after a day).
      ...(query.status === 'OPEN' && !query.orderId
        ? {
            NOT: {
              subject: 'CHECKOUT',
              order: { is: { status: { in: ['PENDING_PAYMENT', 'CANCELLED'] } } },
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.riskAssessment.findMany({
        where,
        include: viewInclude,
        orderBy: { createdAt: query.status === 'OPEN' ? 'asc' : 'desc' },
        skip: (query.page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.riskAssessment.count({ where }),
    ]);
    return {
      items: rows.map(toView),
      total,
      page: query.page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(id: string): Promise<RiskAssessmentView> {
    const row = await this.prisma.riskAssessment.findUnique({
      where: { id },
      include: viewInclude,
    });
    if (!row) throw new NotFoundException('Review not found.');
    return toView(row);
  }

  /**
   * Records a reviewer's decision and releases holds that no other open review keeps. Cancelling
   * a confirmed-fraud order is the caller's job, before this (it needs the orders service).
   */
  async review(id: string, input: RiskReview, actor: ActorContext): Promise<RiskAssessmentView> {
    const row = await this.prisma.riskAssessment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Review not found.');
    if (!row.status) throw new ConflictException('Nothing to review: this was not held.');
    const status = input.outcome === 'clear' ? 'CLEARED' : 'CONFIRMED';

    await this.prisma.$transaction(async (tx) => {
      await tx.riskAssessment.update({
        where: { id },
        data: {
          status,
          reviewedById: actor.user.id,
          reviewedAt: new Date(),
          reviewNote: input.note ?? null,
        },
      });
      await this.releaseHolds(tx, row, status);
    });

    await this.audit.record({
      action: `risk.${input.outcome === 'clear' ? 'cleared' : 'confirmed'}`,
      actorId: actor.user.id,
      entityType: row.orderId ? 'order' : 'seller',
      entityId: row.orderId ?? row.sellerId ?? id,
      meta: actor.meta,
      metadata: { reviewId: id, subject: row.subject, score: row.score, note: input.note ?? null },
    });
    return this.get(id);
  }

  private async releaseHolds(
    tx: Prisma.TransactionClient,
    row: RiskAssessment,
    status: 'CLEARED' | 'CONFIRMED',
  ): Promise<void> {
    const stillOpen = (where: Prisma.RiskAssessmentWhereInput, subjects: RiskSubject[]) =>
      tx.riskAssessment.count({
        where: { ...where, status: 'OPEN', subject: { in: subjects }, id: { not: row.id } },
      });
    if (row.subject === 'CHECKOUT' && row.orderId && status === 'CLEARED') {
      if (!(await stillOpen({ orderId: row.orderId }, ['CHECKOUT']))) {
        await tx.order.update({ where: { id: row.orderId }, data: { riskHold: false } });
        // Stores were told to wait: tell them to ship.
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'order',
            aggregateId: row.orderId,
            type: 'risk.order_cleared',
            payload: {},
          },
        });
      }
    }
    // A confirmed payout review keeps the store's payouts on hold until a later review clears it.
    if (row.subject === 'PAYOUT' && row.sellerId && status === 'CLEARED') {
      if (!(await stillOpen({ sellerId: row.sellerId }, ['PAYOUT']))) {
        await tx.seller.update({ where: { id: row.sellerId }, data: { payoutsHeld: false } });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'seller',
            aggregateId: row.sellerId,
            type: 'risk.payouts_released',
            payload: {},
          },
        });
      }
    }
  }

  /** Daily: forget allowed checkouts once the look-back rules no longer need them. */
  async purge(): Promise<number> {
    const { count } = await this.prisma.riskAssessment.deleteMany({
      where: {
        decision: 'ALLOW',
        status: null,
        createdAt: { lt: new Date(Date.now() - KEEP_ALLOWED_DAYS * DAY) },
      },
    });
    return count;
  }

  /** For the order page in the Ops Center. */
  async forOrder(orderId: string): Promise<RiskAssessmentView[]> {
    const rows = await this.prisma.riskAssessment.findMany({
      where: { orderId },
      include: viewInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toView);
  }
}

function toView(row: ViewRow): RiskAssessmentView {
  return {
    id: row.id,
    subject: row.subject,
    score: row.score,
    decision: row.decision,
    signals: row.signals as RiskSignal[],
    enforced: row.enforced,
    status: row.status,
    amountCents: row.amountCents,
    currency: row.order?.currency ?? 'USD',
    order: row.order
      ? {
          id: row.order.id,
          number: row.order.number,
          status: row.order.status,
          email: row.order.email,
          riskHold: row.order.riskHold,
        }
      : null,
    seller: row.seller,
    email: row.email,
    ipAddress: row.ipAddress,
    reviewedBy: row.reviewedBy?.email ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
  };
}
