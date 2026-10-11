import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatters, translator } from '@nixzora/i18n';
import {
  buyReminderAt,
  buyReminderProblem,
  type BuyReminderView,
  type ProductCard,
} from '@nixzora/validation';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { toLocale } from '../../common/locale';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { PushService } from '../devices/push.service';
import { MailService } from '../notifications/mail.service';

const SWEEP_MS = 15 * 60 * 1000;

/**
 * "Remind me to buy" (p10-36): a customer picks a day; at 9:00 Eastern that day they get a push
 * and an email with today's price (and what it was, if it dropped). Each reminder is deleted as
 * it's sent, so it goes out once. Reminders for products no longer on sale are dropped quietly.
 */
@Injectable()
export class BuyRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BuyRemindersService.name);
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

  async list(userId: string): Promise<BuyReminderView[]> {
    const rows = await this.prisma.buyReminder.findMany({
      where: { userId },
      orderBy: { remindAt: 'asc' },
    });
    const cards = new Map(
      (await this.catalog.cardsByIds(rows.map((row) => row.productId))).map((c) => [c.id, c]),
    );
    return rows.map((row) => ({
      productId: row.productId,
      date: row.remindOn.toISOString().slice(0, 10),
      priceCents: row.priceCents,
      createdAt: row.createdAt.toISOString(),
      product: cards.get(row.productId) ?? null,
    }));
  }

  /** Sets (or moves) the reminder for a product. */
  async set(userId: string, productId: string, date: string): Promise<BuyReminderView> {
    const problem = buyReminderProblem(date);
    if (problem) throw new BadRequestException(problem);
    const [card] = await this.catalog.cardsByIds([productId]);
    if (!card) throw new NotFoundException('That product is not available.');
    const data = {
      remindOn: new Date(`${date}T00:00:00Z`),
      remindAt: buyReminderAt(date),
      priceCents: card.priceFromCents,
    };
    const row = await this.prisma.buyReminder.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, ...data },
      update: data,
    });
    return {
      productId,
      date,
      priceCents: row.priceCents,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.prisma.buyReminder.deleteMany({ where: { userId, productId } });
  }

  /** Sends what is due. Returns how many went out. */
  async sweep(now = new Date()): Promise<number> {
    const due = await this.prisma.buyReminder.findMany({
      where: { remindAt: { lte: now } },
      select: {
        userId: true,
        productId: true,
        priceCents: true,
        user: { select: { email: true, language: true, status: true } },
      },
      take: 2000,
    });
    if (!due.length) return 0;
    const cards = new Map(
      (await this.catalog.cardsByIds([...new Set(due.map((r) => r.productId))])).map((card) => [
        card.id,
        card,
      ]),
    );
    let sent = 0;
    for (const reminder of due) {
      // Claimed by deleting it, so a second sweep can't send it again.
      const { count } = await this.prisma.buyReminder.deleteMany({
        where: { userId: reminder.userId, productId: reminder.productId },
      });
      const card = cards.get(reminder.productId);
      if (!count || !card || reminder.user.status !== 'ACTIVE') continue;
      try {
        await this.notify(reminder, card);
        sent++;
      } catch (error) {
        this.logger.warn(`Buy reminder not sent: ${(error as Error).message}`);
      }
    }
    if (sent) this.logger.log(`Buy reminders sent: ${sent}`);
    return sent;
  }

  private async notify(
    reminder: { userId: string; priceCents: number; user: { email: string; language: string } },
    card: ProductCard,
  ): Promise<void> {
    const locale = toLocale(reminder.user.language);
    const t = translator(locale)('email');
    const money = formatters(locale).money;
    const web = this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
    const dropped = card.priceFromCents < reminder.priceCents;
    const kind = dropped ? 'buyReminderDrop' : 'buyReminder';
    const vars = {
      title: card.title,
      price: money(card.priceFromCents),
      was: money(reminder.priceCents),
      link: `${web}/p/${card.slug}`,
    };
    await this.push.sendToUser(reminder.userId, {
      title: t(`push_${kind}_title`),
      body: t(`push_${kind}_body`, vars),
      data: { path: `/p/${card.slug}` },
    });
    await this.mail.trySend({
      to: reminder.user.email,
      subject: t(`remind_${kind}_subject`, vars),
      text: t(`remind_${kind}_text`, vars),
      template: `alerts.${kind}`,
      data: { title: card.title, link: vars.link },
    });
  }
}
