import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatters, translator } from '@nixzora/i18n';
import {
  RETURN_REMIND_DAYS,
  RETURN_WINDOW_DAYS,
  WARRANTY_REMIND_DAYS,
  addDays,
  easternToday,
  warrantyStatus,
  type WarrantyView,
} from '@nixzora/validation';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { toLocale } from '../../common/locale';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { PushService } from '../devices/push.service';
import { MailService } from '../notifications/mail.service';
import { itemWarrantyUntil, orderAccessToken } from '../orders/order-links';

const SWEEP_MS = 60 * 60 * 1000;
const DAY_MS = 86_400_000;
/** Orders whose warranties could still be running: the longest warranty, plus slack. */
const WARRANTY_LOOKBACK_MS = 121 * 31 * DAY_MS;

type Recipient = {
  userId: string | null;
  email: string;
  language: string;
};

/**
 * Order reminders (p10-33): two days before a return window closes (delivered goods with no
 * return started), and three weeks before a warranty ends. Checked hourly; each reminder is
 * claimed in the database before it's sent, so it goes out once. Customers can turn them off in
 * their preferences; guests get the email only.
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
    private readonly push: PushService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (!runsBackgroundJobs(this.config)) return;
    this.sweeper = setInterval(() => void this.sweep().catch(() => undefined), SWEEP_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  /** A customer's warranties, the ones still running first, then the most recently ended. */
  async warranties(userId: string): Promise<WarrantyView[]> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        warrantyMonths: { not: null },
        order: { userId, placedAt: { not: null }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      },
      select: {
        id: true,
        productTitle: true,
        variantTitle: true,
        warrantyMonths: true,
        variant: { select: { productId: true } },
        seller: { select: { handle: true, displayName: true } },
        order: { select: { number: true, status: true, placedAt: true, deliveredAt: true } },
      },
      orderBy: { order: { placedAt: 'desc' } },
      take: 500,
    });
    const productIds = [
      ...new Set(items.map((item) => item.variant?.productId).filter((id): id is string => !!id)),
    ];
    const cards = new Map((await this.catalog.cardsByIds(productIds)).map((c) => [c.id, c]));
    const views: WarrantyView[] = [];
    for (const item of items) {
      const until = itemWarrantyUntil(item.order, item);
      const start = item.order.deliveredAt ?? item.order.placedAt;
      if (!until || !start) continue;
      const card = item.variant ? cards.get(item.variant.productId) : undefined;
      views.push({
        orderItemId: item.id,
        orderNumber: item.order.number,
        productTitle: item.productTitle,
        variantTitle: item.variantTitle,
        productSlug: card?.slug ?? null,
        imageUrl: card?.image?.url ?? null,
        seller: item.seller,
        months: item.warrantyMonths!,
        from: easternToday(start),
        until,
        status: warrantyStatus(until),
      });
    }
    const rank = { ENDING_SOON: 0, ACTIVE: 1, ENDED: 2 } as const;
    return views.sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        (a.status === 'ENDED' ? b.until.localeCompare(a.until) : a.until.localeCompare(b.until)),
    );
  }

  /** Sends what is due. Returns how many reminders went out. */
  async sweep(now = new Date()): Promise<number> {
    const returns = await this.sweepReturns(now);
    const warranties = await this.sweepWarranties(now);
    if (returns + warranties)
      this.logger.log(`Order reminders sent: ${returns} return, ${warranties} warranty`);
    return returns + warranties;
  }

  private async sweepReturns(now: Date): Promise<number> {
    const windowMs = RETURN_WINDOW_DAYS * DAY_MS;
    // Delivered between (window - 2 days) and (window) ago: the window closes within two days.
    const orders = await this.prisma.order.findMany({
      where: {
        kind: 'GOODS',
        status: { in: ['DELIVERED', 'PARTIALLY_REFUNDED'] },
        returnRemindedAt: null,
        returns: { none: {} },
        deliveredAt: {
          gt: new Date(now.getTime() - windowMs),
          lte: new Date(now.getTime() - windowMs + RETURN_REMIND_DAYS * DAY_MS),
        },
        OR: [{ userId: null }, { user: { status: 'ACTIVE', orderReminders: true } }],
      },
      select: {
        id: true,
        number: true,
        email: true,
        language: true,
        userId: true,
        deliveredAt: true,
        user: { select: { email: true, language: true } },
      },
      take: 2000,
    });
    let sent = 0;
    for (const order of orders) {
      const { count } = await this.prisma.order.updateMany({
        where: { id: order.id, returnRemindedAt: null },
        data: { returnRemindedAt: now },
      });
      if (!count) continue;
      try {
        const closes = new Date(order.deliveredAt!.getTime() + windowMs);
        await this.notifyReturn(
          {
            userId: order.userId,
            email: order.user?.email ?? order.email,
            language: order.user?.language ?? order.language,
          },
          order,
          closes,
        );
        sent++;
      } catch (error) {
        this.logger.warn(`Return reminder not sent: ${(error as Error).message}`);
      }
    }
    return sent;
  }

  private async sweepWarranties(now: Date): Promise<number> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        warrantyMonths: { not: null },
        warrantyRemindedAt: null,
        order: {
          userId: { not: null },
          placedAt: { gt: new Date(now.getTime() - WARRANTY_LOOKBACK_MS) },
          status: { notIn: ['CANCELLED', 'REFUNDED', 'PENDING_PAYMENT'] },
          user: { status: 'ACTIVE', orderReminders: true },
        },
      },
      select: {
        id: true,
        productTitle: true,
        warrantyMonths: true,
        seller: { select: { handle: true, displayName: true } },
        order: {
          select: {
            number: true,
            status: true,
            placedAt: true,
            deliveredAt: true,
            userId: true,
            user: { select: { email: true, language: true } },
          },
        },
      },
      take: 5000,
    });
    const today = easternToday(now);
    const soon = addDays(today, WARRANTY_REMIND_DAYS);
    let sent = 0;
    for (const item of items) {
      const until = itemWarrantyUntil(item.order, item);
      // Only while it's still running; one that ended unnoticed isn't worth a reminder.
      if (!until || until < today || until > soon || !item.order.user) continue;
      const { count } = await this.prisma.orderItem.updateMany({
        where: { id: item.id, warrantyRemindedAt: null },
        data: { warrantyRemindedAt: now },
      });
      if (!count) continue;
      try {
        await this.notifyWarranty(
          { userId: item.order.userId, ...item.order.user },
          item.productTitle,
          item.order.number,
          item.seller,
          until,
        );
        sent++;
      } catch (error) {
        this.logger.warn(`Warranty reminder not sent: ${(error as Error).message}`);
      }
    }
    return sent;
  }

  private web(): string {
    return this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
  }

  private async notifyReturn(
    to: Recipient,
    order: { id: string; number: string },
    closes: Date,
  ): Promise<void> {
    const { number } = order;
    const token = orderAccessToken(this.config.get('ORDER_LINK_SECRET', { infer: true }), order.id);
    const locale = toLocale(to.language);
    const t = translator(locale)('email');
    const web = this.web();
    const vars = {
      number,
      date: formatters(locale).date(closes),
      link: `${web}/orders/${number}?token=${token}`,
      prefs: `${web}/account/preferences`,
    };
    if (to.userId) {
      await this.push.sendToUser(to.userId, {
        title: t('push_remindReturn_title'),
        body: t('push_remindReturn_body', vars),
        data: { path: `/orders/${number}`, orderNumber: number },
      });
    }
    await this.mail.trySend({
      to: to.email,
      subject: t('remind_return_subject', vars),
      text: t('remind_return_text', vars),
      template: 'reminders.return',
      data: { number, link: vars.link },
    });
  }

  private async notifyWarranty(
    to: Recipient,
    title: string,
    number: string,
    seller: { handle: string; displayName: string } | null,
    until: string,
  ): Promise<void> {
    const locale = toLocale(to.language);
    const t = translator(locale)('email');
    const web = this.web();
    const vars = {
      title,
      number,
      date: formatters(locale).date(`${until}T12:00:00Z`),
      store: seller?.displayName ?? 'NIXZORA',
      contact: seller
        ? `${web}/account/messages/new?store=${encodeURIComponent(seller.handle)}&order=${number}`
        : `${web}/help`,
      link: `${web}/account/warranties`,
      prefs: `${web}/account/preferences`,
    };
    if (to.userId) {
      await this.push.sendToUser(to.userId, {
        title: t('push_remindWarranty_title'),
        body: t('push_remindWarranty_body', vars),
        data: { path: '/account/warranties' },
      });
    }
    await this.mail.trySend({
      to: to.email,
      subject: t('remind_warranty_subject', vars),
      text: t('remind_warranty_text', vars),
      template: 'reminders.warranty',
      data: { title, link: vars.link },
    });
  }
}
