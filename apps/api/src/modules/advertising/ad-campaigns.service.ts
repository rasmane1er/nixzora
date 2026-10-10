import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AdCampaignCreate,
  type AdCampaignUpdate,
  type AdCampaignView,
  type AdCreditGrant,
  type AdminAdCampaignView,
  type AdSellerCredit,
  type AdStats,
  type SellerAdsOverview,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { StorageService } from '../media/storage.service';
import { SellersService } from '../sellers/sellers.service';
import { utcDay } from './ads.service';

/** Campaigns a store can have at once (paused ones count). */
const MAX_CAMPAIGNS = 20;

const CAMPAIGN_INCLUDE = {
  products: {
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  seller: { select: { id: true, handle: true, displayName: true } },
} satisfies Prisma.AdCampaignInclude;

type CampaignRow = Prisma.AdCampaignGetPayload<{ include: typeof CAMPAIGN_INCLUDE }>;

const ZERO: AdStats = { impressions: 0, clicks: 0, spendCents: 0 };

/** Sponsored product campaigns: the seller portal's Ads page and the Ops Center's (p10-01). */
@Injectable()
export class AdCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellers: SellersService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  // ───────────── Seller portal ─────────────

  async overview(actor: ActorContext, now = new Date()): Promise<SellerAdsOverview> {
    const { seller } = await this.sellers.require(actor.user.id);
    const [campaigns, ledger, unbilled, promotable, daily] = await Promise.all([
      this.prisma.adCampaign.findMany({
        where: { sellerId: seller.id },
        include: CAMPAIGN_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sellerLedgerEntry.aggregate({
        where: { sellerId: seller.id },
        _sum: { amountCents: true },
      }),
      this.prisma.adClick.aggregate({
        where: { sellerId: seller.id, billedAt: null },
        _sum: { costCents: true },
      }),
      this.prisma.product.findMany({
        where: { sellerId: seller.id, status: 'ACTIVE' },
        orderBy: { title: 'asc' },
        take: 500,
        select: {
          id: true,
          slug: true,
          title: true,
          images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
        },
      }),
      this.dailyStats({ sellerId: seller.id }, 14, now),
    ]);
    const unbilledCents = unbilled._sum.costCents ?? 0;
    const stats = await this.stats(
      campaigns.map((c) => c.id),
      now,
    );
    return {
      creditCents: seller.adCreditCents,
      fundsCents: seller.adCreditCents + (ledger._sum.amountCents ?? 0) - unbilledCents,
      unbilledCents,
      campaigns: campaigns.map((c) => this.view(c, stats, now)),
      daily,
      promotable: promotable.map((p) => this.productRef(p)),
    };
  }

  async create(input: AdCampaignCreate, actor: ActorContext): Promise<AdCampaignView> {
    const { seller } = await this.sellers.require(actor.user.id, { write: true });
    if (seller.status !== 'ACTIVE') {
      throw new ConflictException('Your store needs to be approved before it can advertise.');
    }
    if ((await this.prisma.adCampaign.count({ where: { sellerId: seller.id } })) >= MAX_CAMPAIGNS) {
      throw new ConflictException(`A store can have up to ${MAX_CAMPAIGNS} campaigns.`);
    }
    const productIds = await this.ownProducts(seller.id, input.productIds);
    const campaign = await this.prisma.adCampaign.create({
      data: {
        sellerId: seller.id,
        name: input.name,
        dailyBudgetCents: input.dailyBudgetCents,
        bidCents: input.bidCents,
        endsOn: toDay(input.endsOn),
        products: { create: productIds.map((productId) => ({ productId })) },
      },
      include: CAMPAIGN_INCLUDE,
    });
    await this.audit.recordFor(
      { ...actor, actorType: 'USER' },
      'ads.campaign.created',
      'ad_campaign',
      campaign.id,
      {
        products: productIds.length,
        dailyBudgetCents: input.dailyBudgetCents,
        bidCents: input.bidCents,
      },
    );
    return this.view(campaign, await this.stats([campaign.id]));
  }

  async update(id: string, input: AdCampaignUpdate, actor: ActorContext): Promise<AdCampaignView> {
    const { seller } = await this.sellers.require(actor.user.id, { write: true });
    const campaign = await this.prisma.adCampaign.findFirst({ where: { id, sellerId: seller.id } });
    if (!campaign) throw new NotFoundException('Campaign not found.');
    if (campaign.status === 'SUSPENDED' && input.status) {
      throw new ConflictException('This campaign was stopped by NIXZORA. Contact seller support.');
    }
    const productIds = input.productIds
      ? await this.ownProducts(seller.id, input.productIds)
      : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (productIds) {
        await tx.adCampaignProduct.deleteMany({
          where: { campaignId: id, productId: { notIn: productIds } },
        });
        await tx.adCampaignProduct.createMany({
          data: productIds.map((productId) => ({ campaignId: id, productId })),
          skipDuplicates: true,
        });
      }
      return tx.adCampaign.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.dailyBudgetCents !== undefined
            ? { dailyBudgetCents: input.dailyBudgetCents }
            : {}),
          ...(input.bidCents !== undefined ? { bidCents: input.bidCents } : {}),
          ...(input.endsOn !== undefined ? { endsOn: toDay(input.endsOn) } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        include: CAMPAIGN_INCLUDE,
      });
    });
    await this.audit.recordFor(
      { ...actor, actorType: 'USER' },
      'ads.campaign.updated',
      'ad_campaign',
      id,
      {
        changed: Object.keys(input),
      },
    );
    return this.view(updated, await this.stats([id]));
  }

  // ───────────── Ops ─────────────

  async list(status?: string, now = new Date()): Promise<AdminAdCampaignView[]> {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: status === 'ACTIVE' || status === 'PAUSED' || status === 'SUSPENDED' ? { status } : {},
      include: CAMPAIGN_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const stats = await this.stats(
      campaigns.map((c) => c.id),
      now,
    );
    return campaigns.map((c) => ({ ...this.view(c, stats, now), seller: c.seller }));
  }

  async suspend(id: string, reason: string, actor: ActorContext): Promise<AdminAdCampaignView> {
    return this.setByStaff(
      id,
      { status: 'SUSPENDED', suspendedReason: reason },
      actor,
      'ads.campaign.suspended',
    );
  }

  /** Lifts a suspension: the campaign comes back paused, for the seller to resume. */
  async restore(id: string, actor: ActorContext): Promise<AdminAdCampaignView> {
    return this.setByStaff(
      id,
      { status: 'PAUSED', suspendedReason: null },
      actor,
      'ads.campaign.restored',
    );
  }

  async sellersWithCredit(): Promise<AdSellerCredit[]> {
    const sellers = await this.prisma.seller.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { displayName: 'asc' },
      take: 500,
      select: { id: true, handle: true, displayName: true, adCreditCents: true },
    });
    return sellers.map((s) => ({
      id: s.id,
      handle: s.handle,
      displayName: s.displayName,
      creditCents: s.adCreditCents,
    }));
  }

  async grantCredit(sellerId: string, input: AdCreditGrant, actor: ActorContext) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Seller not found.');
    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: { adCreditCents: { increment: input.amountCents } },
      select: { adCreditCents: true },
    });
    await this.audit.recordFor(actor, 'ads.credit.granted', 'seller', sellerId, {
      amountCents: input.amountCents,
      note: input.note,
    });
    return { creditCents: updated.adCreditCents };
  }

  private async setByStaff(
    id: string,
    data: Prisma.AdCampaignUpdateInput,
    actor: ActorContext,
    action: string,
  ): Promise<AdminAdCampaignView> {
    const exists = await this.prisma.adCampaign.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Campaign not found.');
    const campaign = await this.prisma.adCampaign.update({
      where: { id },
      data,
      include: CAMPAIGN_INCLUDE,
    });
    await this.audit.recordFor(actor, action, 'ad_campaign', id, {
      reason: data.suspendedReason ?? null,
    });
    return { ...this.view(campaign, await this.stats([id])), seller: campaign.seller };
  }

  // ───────────── Helpers ─────────────

  /** The listed products, which must be this store's active listings. */
  private async ownProducts(sellerId: string, ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    const found = await this.prisma.product.findMany({
      where: { id: { in: unique }, sellerId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException('Choose your own live listings to advertise.');
    }
    return unique;
  }

  /** Today's and the last 30 days' totals per campaign. */
  private async stats(campaignIds: string[], now = new Date()) {
    const out = new Map<string, { today: AdStats; last30Days: AdStats }>();
    if (!campaignIds.length) return out;
    const today = utcDay(now);
    const rows = await this.prisma.adDailyStat.groupBy({
      by: ['campaignId', 'day'],
      where: {
        campaignId: { in: campaignIds },
        day: { gte: new Date(now.getTime() - 29 * 86_400_000 - (now.getTime() % 86_400_000)) },
      },
      _sum: { impressions: true, clicks: true, spendCents: true },
    });
    for (const row of rows) {
      const entry = out.get(row.campaignId) ?? { today: { ...ZERO }, last30Days: { ...ZERO } };
      const sums = {
        impressions: row._sum.impressions ?? 0,
        clicks: row._sum.clicks ?? 0,
        spendCents: row._sum.spendCents ?? 0,
      };
      addTo(entry.last30Days, sums);
      if (row.day.toISOString().slice(0, 10) === today) addTo(entry.today, sums);
      out.set(row.campaignId, entry);
    }
    return out;
  }

  /** Every campaign together, one entry per UTC day (zeros included), oldest first. */
  private async dailyStats(where: { sellerId: string }, days: number, now: Date) {
    const start = new Date(
      `${utcDay(new Date(now.getTime() - (days - 1) * 86_400_000))}T00:00:00Z`,
    );
    const rows = await this.prisma.adDailyStat.groupBy({
      by: ['day'],
      where: { day: { gte: start }, campaign: { sellerId: where.sellerId } },
      _sum: { impressions: true, clicks: true, spendCents: true },
    });
    const byDay = new Map(rows.map((row) => [row.day.toISOString().slice(0, 10), row._sum]));
    return Array.from({ length: days }, (_, i) => {
      const day = utcDay(new Date(start.getTime() + i * 86_400_000));
      const sums = byDay.get(day);
      return {
        day,
        impressions: sums?.impressions ?? 0,
        clicks: sums?.clicks ?? 0,
        spendCents: sums?.spendCents ?? 0,
      };
    });
  }

  private view(
    c: CampaignRow,
    stats: Map<string, { today: AdStats; last30Days: AdStats }>,
    now = new Date(),
  ): AdCampaignView {
    const endsOn = c.endsOn ? c.endsOn.toISOString().slice(0, 10) : null;
    const s = stats.get(c.id);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      suspendedReason: c.suspendedReason,
      dailyBudgetCents: c.dailyBudgetCents,
      bidCents: c.bidCents,
      endsOn,
      ended: endsOn !== null && endsOn < utcDay(now),
      products: c.products.map((cp) => this.productRef(cp.product)),
      today: s?.today ?? { ...ZERO },
      last30Days: s?.last30Days ?? { ...ZERO },
      createdAt: c.createdAt.toISOString(),
    };
  }

  private productRef(p: {
    id: string;
    slug: string;
    title: string;
    images: { storageKey: string }[];
  }) {
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      imageUrl: p.images[0] ? this.storage.publicUrl(p.images[0].storageKey) : null,
    };
  }
}

function toDay(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

function addTo(total: AdStats, add: AdStats): void {
  total.impressions += add.impressions;
  total.clicks += add.clicks;
  total.spendCents += add.spendCents;
}
