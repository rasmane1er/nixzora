import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { translator } from '@nixzora/i18n';
import {
  type FollowedStore,
  type FollowingFeed,
  type FollowStatus,
  MAX_FOLLOWED_STORES,
} from '@nixzora/validation';
import { toLocale } from '../../common/locale';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { PushService } from '../devices/push.service';
import { StorageService } from '../media/storage.service';
import { OutboxService } from '../outbox/outbox.service';

const DAY_MS = 86_400_000;
/** One deal notification per store per follower per day, however many deals it starts. */
const NOTIFY_EVERY_MS = DAY_MS;

/**
 * Follow stores (p10-24, ADR-0046): customers follow marketplace stores, see their new listings
 * and live deals on a Following page, and get a push when a followed store starts a deal.
 */
@Injectable()
export class FollowsService implements OnModuleInit {
  private readonly logger = new Logger(FollowsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
    private readonly storage: StorageService,
    private readonly outbox: OutboxService,
    private readonly push: PushService,
  ) {}

  onModuleInit(): void {
    this.outbox.on('deal.started', async ({ payload }) => {
      await this.dealStarted(
        payload as { productId: string; sellerId: string | null; percentOff: number },
      );
    });
  }

  private async store(handle: string) {
    const seller = await this.prisma.seller.findFirst({
      where: { handle, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!seller) throw new NotFoundException('We could not find that store.');
    return seller;
  }

  async status(userId: string | null, handle: string): Promise<FollowStatus> {
    const seller = await this.store(handle);
    const [followers, mine] = await Promise.all([
      this.prisma.storeFollow.count({ where: { sellerId: seller.id } }),
      userId
        ? this.prisma.storeFollow.findUnique({
            where: { userId_sellerId: { userId, sellerId: seller.id } },
          })
        : null,
    ]);
    return { following: Boolean(mine), notify: mine?.notify ?? false, followers };
  }

  async follow(userId: string, handle: string): Promise<FollowStatus> {
    const seller = await this.store(handle);
    // A store's own team following it would inflate its count.
    const member = await this.prisma.sellerMember.findFirst({
      where: { sellerId: seller.id, userId },
    });
    if (member) throw new BadRequestException('You can’t follow your own store.');
    const count = await this.prisma.storeFollow.count({ where: { userId } });
    const existing = await this.prisma.storeFollow.findUnique({
      where: { userId_sellerId: { userId, sellerId: seller.id } },
    });
    if (!existing && count >= MAX_FOLLOWED_STORES) {
      throw new BadRequestException(`You can follow up to ${MAX_FOLLOWED_STORES} stores.`);
    }
    if (!existing) {
      await this.prisma.storeFollow
        .create({ data: { userId, sellerId: seller.id } })
        .catch((error: { code?: string }) => {
          if (error.code !== 'P2002') throw error;
        });
    }
    return this.status(userId, handle);
  }

  async unfollow(userId: string, handle: string): Promise<FollowStatus> {
    const seller = await this.store(handle);
    await this.prisma.storeFollow.deleteMany({ where: { userId, sellerId: seller.id } });
    return this.status(userId, handle);
  }

  async setNotify(userId: string, handle: string, notify: boolean): Promise<FollowStatus> {
    const seller = await this.store(handle);
    const updated = await this.prisma.storeFollow.updateMany({
      where: { userId, sellerId: seller.id },
      data: { notify },
    });
    if (!updated.count) throw new NotFoundException('You don’t follow that store.');
    return this.status(userId, handle);
  }

  async stores(userId: string): Promise<FollowedStore[]> {
    const rows = await this.prisma.storeFollow.findMany({
      where: { userId, seller: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            logoKey: true,
            _count: {
              select: {
                products: {
                  where: {
                    status: 'ACTIVE',
                    createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) },
                  },
                },
              },
            },
          },
        },
      },
    });
    return rows.map((row) => ({
      handle: row.seller.handle,
      displayName: row.seller.displayName,
      logoUrl: row.seller.logoKey ? this.storage.publicUrl(row.seller.logoKey) : null,
      followedAt: row.createdAt.toISOString(),
      notify: row.notify,
      newCount: row.seller._count.products,
    }));
  }

  async feed(userId: string): Promise<FollowingFeed> {
    const stores = await this.stores(userId);
    if (!stores.length) return { stores, newArrivals: [], deals: [] };
    const sellers = await this.prisma.seller.findMany({
      where: { handle: { in: stores.map((s) => s.handle) } },
      select: { id: true, handle: true, displayName: true },
    });
    const bySeller = new Map(sellers.map((s) => [s.id, s]));
    const ids = [...bySeller.keys()];
    const [fresh, onDeal] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          sellerId: { in: ids },
          status: 'ACTIVE',
          createdAt: { gte: new Date(Date.now() - 30 * DAY_MS) },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { id: true, sellerId: true },
      }),
      this.prisma.deal.findMany({
        where: { status: 'LIVE', product: { sellerId: { in: ids }, status: 'ACTIVE' } },
        orderBy: { endsAt: 'asc' },
        take: 40,
        select: { product: { select: { id: true, sellerId: true } } },
      }),
    ]);
    const withStore = async (rows: { id: string; sellerId: string | null }[]) => {
      const cards = await this.catalog.cardsByIds(rows.map((r) => r.id));
      const byId = new Map(cards.map((c) => [c.id, c]));
      return rows
        .map((r) => {
          const card = byId.get(r.id);
          const store = r.sellerId ? bySeller.get(r.sellerId) : undefined;
          return card && store
            ? { ...card, store: { handle: store.handle, displayName: store.displayName } }
            : null;
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
    };
    return {
      stores,
      newArrivals: await withStore(fresh),
      deals: await withStore(onDeal.map((d) => d.product)),
    };
  }

  /** A store's deal went live: push to followers who want it (at most once a day per store). */
  async dealStarted(event: {
    productId: string;
    sellerId: string | null;
    percentOff: number;
  }): Promise<number> {
    if (!event.sellerId) return 0;
    const [seller, product] = await Promise.all([
      this.prisma.seller.findUnique({
        where: { id: event.sellerId },
        select: { handle: true, displayName: true, status: true },
      }),
      this.prisma.product.findUnique({
        where: { id: event.productId },
        select: { title: true, slug: true },
      }),
    ]);
    if (!seller || seller.status !== 'ACTIVE' || !product) return 0;
    const due = new Date(Date.now() - NOTIFY_EVERY_MS);
    const followers = await this.prisma.storeFollow.findMany({
      where: {
        sellerId: event.sellerId,
        notify: true,
        OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: due } }],
      },
      select: { userId: true, user: { select: { language: true } } },
      take: 5000,
    });
    let sent = 0;
    for (const follower of followers) {
      // Claim the slot first, so two deals starting together send one push.
      const claimed = await this.prisma.storeFollow.updateMany({
        where: {
          userId: follower.userId,
          sellerId: event.sellerId,
          OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: due } }],
        },
        data: { lastNotifiedAt: new Date() },
      });
      if (!claimed.count) continue;
      const t = translator(toLocale(follower.user.language))('email');
      try {
        await this.push.sendToUser(follower.userId, {
          title: t('push_storeDeal_title', { store: seller.displayName }),
          body: t('push_storeDeal_body', { product: product.title, percent: event.percentOff }),
          data: { path: `/p/${product.slug}` },
        });
        sent += 1;
      } catch (error) {
        this.logger.warn(`Store deal push failed: ${(error as Error).message}`);
      }
    }
    return sent;
  }
}
