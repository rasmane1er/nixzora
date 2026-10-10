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
import { formatters, translator } from '@nixzora/i18n';
import { type PagedResult, type PayoutView, pagedResult } from '@nixzora/validation';
import { type Env } from '../../config/env';
import { type Payout, Prisma } from '../../generated/prisma/client';
import { settleAdSpend } from '../advertising/ad-billing';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { MailService } from '../notifications/mail.service';
import { PAYOUT_GATEWAY, type PayoutGateway } from '../payments/payout-gateway';
import { RiskService } from '../risk/risk.service';
import { SellersService } from './sellers.service';
import { runsBackgroundJobs } from '../../common/background-jobs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const money = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

/**
 * Seller payouts (p7-06, ADR-0014). A payout debits the seller's available balance in the
 * ledger first, in a transaction holding a per-seller lock, and only then asks the provider to
 * transfer: a payout can never be sent twice, and a failed transfer is credited back.
 */
@Injectable()
export class PayoutsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayoutsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly sellers: SellersService,
    private readonly risk: RiskService,
    private readonly config: ConfigService<Env, true>,
    @Inject(PAYOUT_GATEWAY) private readonly gateway: PayoutGateway,
  ) {}

  private get minimum(): number {
    return this.config.get('PAYOUT_MIN_CENTS', { infer: true });
  }

  onModuleInit(): void {
    if (!runsBackgroundJobs(this.config) || !this.config.get('PAYOUTS_AUTO', { infer: true })) {
      return;
    }
    // Checked hourly; each store is paid at most once a day.
    this.timer = setInterval(() => void this.runDue().catch(() => undefined), HOUR);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Pays every store with enough available balance and no payout in the last day. */
  async runDue(): Promise<{ paid: number; failed: number }> {
    // One API task runs it at a time.
    const lock = await this.redis.client
      .set('payouts:run', '1', 'EX', 50 * 60, 'NX')
      .catch(() => null);
    if (lock !== 'OK') return { paid: 0, failed: 0 };
    const now = new Date();
    const candidates = await this.prisma.sellerLedgerEntry.groupBy({
      by: ['sellerId'],
      where: {
        availableAt: { lte: now },
        seller: {
          status: 'ACTIVE',
          payoutsEnabled: true,
          payoutsHeld: false,
          payoutProvider: this.gateway.name,
          payouts: { none: { createdAt: { gt: new Date(now.getTime() - DAY) } } },
        },
      },
      _sum: { amountCents: true },
      having: { amountCents: { _sum: { gte: this.minimum } } },
    });
    let paid = 0;
    let failed = 0;
    for (const { sellerId } of candidates) {
      try {
        const payout = await this.payOut(sellerId);
        if (payout.status === 'PAID') paid++;
        else failed++;
      } catch (error) {
        this.logger.warn(`Payout skipped for ${sellerId}: ${(error as Error).message}`);
      }
    }
    if (paid || failed) this.logger.log(`Payouts: ${paid} sent, ${failed} failed`);
    return { paid, failed };
  }

  /** Sends the store's whole available balance. `actor` is the staff member, if any. */
  async payOut(sellerId: string, actor?: ActorContext): Promise<PayoutView> {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Seller not found.');
    if (seller.status !== 'ACTIVE') throw new ConflictException('Only approved stores are paid.');
    if (!seller.payoutsEnabled || !seller.payoutAccountId) {
      throw new ConflictException('The store has not finished payout verification.');
    }
    if (seller.payoutProvider !== this.gateway.name) {
      throw new ConflictException(
        'The store verified with another payout provider. Ask it to update its payout details.',
      );
    }

    // Ad clicks so far come out of this payout, not the next one (p10-01).
    await settleAdSpend(this.prisma, sellerId);

    // Fraud signals (ADR-0024): a store under review is not paid, by the timer or by staff.
    const due = await this.prisma.sellerLedgerEntry.aggregate({
      where: { sellerId, availableAt: { lte: new Date() } },
      _sum: { amountCents: true },
    });
    if (await this.risk.checkPayout(sellerId, due._sum.amountCents ?? 0)) {
      throw new ConflictException(
        'Payouts for this store are on hold while we review recent activity.',
      );
    }

    // 1. Debit the balance under a per-seller lock, so two runs can't pay the same money.
    const payout = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payout:${sellerId}`}))`;
      if (await tx.payout.count({ where: { sellerId, status: 'PENDING' } })) {
        throw new ConflictException('A payout for this store is already being sent.');
      }
      const now = new Date();
      const available =
        (
          await tx.sellerLedgerEntry.aggregate({
            where: { sellerId, availableAt: { lte: now } },
            _sum: { amountCents: true },
          })
        )._sum.amountCents ?? 0;
      if (available < this.minimum) {
        throw new ConflictException(
          `Payouts start at ${money(this.minimum)}; available now: ${money(available)}.`,
        );
      }
      const row = await tx.payout.create({
        data: {
          sellerId,
          amountCents: available,
          provider: this.gateway.name,
          requestedBy: actor?.user.id ?? null,
        },
      });
      await tx.sellerLedgerEntry.create({
        data: {
          sellerId,
          payoutId: row.id,
          type: 'PAYOUT',
          amountCents: -available,
          availableAt: now,
          description: 'Payout to your bank',
          idempotencyKey: `payout:${row.id}`,
        },
      });
      return row;
    });

    // 2. Transfer. The provider's idempotency key is our payout id, so a retry is harmless.
    let result: Payout;
    try {
      const transfer = await this.gateway.transfer({
        accountId: seller.payoutAccountId,
        amountCents: payout.amountCents,
        currency: payout.currency,
        payoutId: payout.id,
        description: `NIXZORA payout to ${seller.displayName}`,
      });
      result = await this.prisma.payout.update({
        where: { id: payout.id },
        data: { status: 'PAID', providerTransferId: transfer.id, paidAt: new Date() },
      });
    } catch (error) {
      const reason = (error as Error).message.slice(0, 300);
      this.logger.error(`Payout ${payout.id} failed: ${reason}`);
      // 3. Failed: put the money back.
      result = await this.prisma.$transaction(async (tx) => {
        await tx.sellerLedgerEntry.create({
          data: {
            sellerId,
            payoutId: payout.id,
            type: 'ADJUSTMENT',
            amountCents: payout.amountCents,
            availableAt: new Date(),
            description: 'Payout failed: amount returned to your balance',
            idempotencyKey: `payout-reversal:${payout.id}`,
          },
        });
        return tx.payout.update({
          where: { id: payout.id },
          data: { status: 'FAILED', failureReason: reason },
        });
      });
    }

    await this.audit.record({
      action: result.status === 'PAID' ? 'seller.payout.paid' : 'seller.payout.failed',
      actorType: actor ? 'ADMIN' : 'SYSTEM',
      actorId: actor?.user.id ?? null,
      entityType: 'seller',
      entityId: sellerId,
      meta: actor?.meta,
      metadata: {
        payoutId: result.id,
        amountCents: result.amountCents,
        provider: result.provider,
        ...(result.failureReason ? { reason: result.failureReason } : {}),
      },
    });
    if (result.status === 'PAID') {
      const locale = await this.sellers.ownerLocale(sellerId);
      const t = translator(locale)('email');
      const amount = formatters(locale).money(result.amountCents, result.currency);
      await this.mail.trySend({
        to: seller.contactEmail,
        subject: t('seller_payout_subject', { amount }),
        text: t(result.provider === 'FAKE' ? 'seller_payout_textTest' : 'seller_payout_text', {
          amount,
          store: seller.displayName,
          link: `${this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '')}/sell/earnings`,
        }),
        template: 'sellers.payout-sent',
        data: { amount: String(result.amountCents) },
      });
    }
    return toView(result);
  }

  async listForSeller(actor: ActorContext, page = 1): Promise<PagedResult<PayoutView>> {
    const { seller } = await this.sellers.require(actor.user.id);
    return this.list(seller.id, page);
  }

  async list(sellerId: string, page = 1, pageSize = 25): Promise<PagedResult<PayoutView>> {
    const where: Prisma.PayoutWhereInput = { sellerId };
    const [total, rows] = await Promise.all([
      this.prisma.payout.count({ where }),
      this.prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return pagedResult(rows.map(toView), total, { page, pageSize });
  }
}

function toView(row: Payout): PayoutView {
  return {
    id: row.id,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    failureReason: row.failureReason,
    automatic: !row.requestedBy,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
  };
}
