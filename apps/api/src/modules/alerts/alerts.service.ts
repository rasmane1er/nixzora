import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatters, translator } from '@nixzora/i18n';
import { type ProductAlertKind, type ProductCard } from '@nixzora/validation';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { toLocale } from '../../common/locale';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { PushService } from '../devices/push.service';
import { MailService } from '../notifications/mail.service';

/** A price-drop alert fires when the price is at least this much lower than last told. */
export const PRICE_DROP_RATIO = 0.95;
const SWEEP_MS = 30 * 60 * 1000;

/**
 * Back-in-stock and price-drop alerts (p10-06), by push and email. Shoppers ask for a
 * back-in-stock alert on a sold-out product page; saved (wishlist) products get both kinds.
 * Checked every half hour; each alert fires once per event (a back-in-stock alert is used up,
 * a price-drop alert moves to the new price), and never when the customer turned them off.
 */
@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertsService.name);
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

  async list(userId: string): Promise<{ productId: string; kind: ProductAlertKind }[]> {
    return this.prisma.productAlert.findMany({
      where: { userId },
      select: { productId: true, kind: true },
    });
  }

  async subscribe(userId: string, productId: string, kind: ProductAlertKind): Promise<void> {
    const [card] = await this.catalog.cardsByIds([productId]);
    if (!card) throw new NotFoundException('That product is not available.');
    await this.prisma.productAlert.upsert({
      where: { userId_productId_kind: { userId, productId, kind } },
      create: {
        userId,
        productId,
        kind,
        priceCents: kind === 'PRICE_DROP' ? card.priceFromCents : null,
      },
      update: {},
    });
  }

  async unsubscribe(userId: string, productId: string, kind: ProductAlertKind): Promise<void> {
    await this.prisma.productAlert.deleteMany({ where: { userId, productId, kind } });
  }

  /** Sends what is due. Returns how many alerts fired. */
  async sweep(): Promise<number> {
    const alerts = await this.prisma.productAlert.findMany({
      where: { user: { status: 'ACTIVE', stockAlerts: true }, product: { status: 'ACTIVE' } },
      select: {
        userId: true,
        productId: true,
        kind: true,
        priceCents: true,
        user: { select: { email: true, language: true } },
      },
      take: 5000,
    });
    if (!alerts.length) return 0;
    const cards = new Map(
      (await this.catalog.cardsByIds([...new Set(alerts.map((a) => a.productId))])).map((card) => [
        card.id,
        card,
      ]),
    );
    let sent = 0;
    for (const alert of alerts) {
      const card = cards.get(alert.productId);
      if (!card?.inStock) continue;
      const key = {
        userId_productId_kind: {
          userId: alert.userId,
          productId: alert.productId,
          kind: alert.kind,
        },
      };
      try {
        if (alert.kind === 'BACK_IN_STOCK') {
          // Used up, so it fires once; the shopper can ask again.
          const { count } = await this.prisma.productAlert.deleteMany({
            where: key.userId_productId_kind,
          });
          if (!count) continue;
          await this.notify(alert, card, 'backInStock', null);
          sent++;
        } else if (
          alert.priceCents !== null &&
          card.priceFromCents <= Math.floor(alert.priceCents * PRICE_DROP_RATIO)
        ) {
          // Claim the drop first, so a second sweep cannot send it again.
          const { count } = await this.prisma.productAlert.updateMany({
            where: { ...key.userId_productId_kind, priceCents: alert.priceCents },
            data: { priceCents: card.priceFromCents },
          });
          if (!count) continue;
          await this.notify(alert, card, 'priceDrop', alert.priceCents);
          sent++;
        } else if (alert.priceCents !== null && card.priceFromCents > alert.priceCents) {
          // The price went up: the next drop is measured from here.
          await this.prisma.productAlert.updateMany({
            where: key.userId_productId_kind,
            data: { priceCents: card.priceFromCents },
          });
        }
      } catch (error) {
        this.logger.warn(`Alert not sent: ${(error as Error).message}`);
      }
    }
    if (sent) this.logger.log(`Product alerts sent: ${sent}`);
    return sent;
  }

  private async notify(
    alert: { userId: string; user: { email: string; language: string } },
    card: ProductCard,
    kind: 'backInStock' | 'priceDrop',
    wasCents: number | null,
  ): Promise<void> {
    const locale = toLocale(alert.user.language);
    const t = translator(locale)('email');
    const money = formatters(locale).money;
    const web = this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
    const vars = {
      title: card.title,
      price: money(card.priceFromCents),
      was: wasCents === null ? '' : money(wasCents),
      link: `${web}/p/${card.slug}`,
      prefs: `${web}/account/preferences`,
    };
    await this.push.sendToUser(alert.userId, {
      title: t(`push_${kind}_title`),
      body: t(`push_${kind}_body`, vars),
      data: { path: `/p/${card.slug}` },
    });
    await this.mail.trySend({
      to: alert.user.email,
      subject: t(`alert_${kind}_subject`, vars),
      text: t(`alert_${kind}_text`, vars),
      template: `alerts.${kind}`,
      data: { title: card.title, link: vars.link },
    });
  }
}
