import {
  BadRequestException,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AD_MIN_BID_CENTS,
  type AdClickResult,
  type AdPlacement,
  type AdQuery,
  type ProductCard,
  type SponsoredProducts,
} from '@nixzora/validation';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { type Env } from '../../config/env';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { RecommendationsService, type Shopper } from '../recommendations/recommendations.service';
import { settleAllAdSpend } from './ad-billing';
import { AD_TOKEN_TTL_MS, AdTokens } from './ad-token';

/** How many ads each placement shows by default. */
const DEFAULT_LIMIT: Record<AdPlacement, number> = { search: 2, category: 2, product: 6, home: 8 };
/** A search ad must be at least this relevant compared with the best organic match. */
const MIN_SEARCH_RELEVANCE = 0.35;
/** The same shopper opening the same ad again within this window is free. */
const REPEAT_CLICK_MS = 24 * 60 * 60 * 1000;
/** Who clicked is forgotten after this many days (spend and counts are kept). */
const CLICK_IDENTITY_DAYS = 90;
const SWEEP_MS = 60 * 60 * 1000;

type Candidate = {
  campaignId: string;
  productId: string;
  sellerId: string;
  bidCents: number;
  /** What the campaign may still spend today, and what the store may spend at all. */
  capCents: number;
};

type Ranked = Candidate & { card: ProductCard; quality: number; adRank: number };

/** "2026-10-09" for the current UTC day: budgets and stats follow UTC days. */
export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Sponsored products (p10-01): which ads to show and what a click costs.
 *
 * An ad is only eligible when it matches the page: a search (ranked like the results), a
 * category (and its subcategories), the product being viewed (similar products) or, on the home
 * page, the shopper's own activity. Among eligible ads, the order is bid × quality, where quality
 * is that relevance nudged by the product's rating, so a cheap, relevant, well-reviewed ad beats
 * an expensive, loosely related one. Each ad's price is the least it needed to keep its place
 * (generalized second price), never above its bid, never below AD_MIN_BID_CENTS.
 */
@Injectable()
export class AdsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdsService.name);
  private readonly tokens: AdTokens;
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
    private readonly recommendations: RecommendationsService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.tokens = new AdTokens(config.get('ORDER_LINK_SECRET', { infer: true }));
  }

  onModuleInit(): void {
    if (!runsBackgroundJobs(this.config)) return;
    this.sweeper = setInterval(() => void this.sweep(), SWEEP_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  /** Hourly: charge unbilled clicks to stores, and forget who clicked old ads. */
  async sweep(now = new Date()): Promise<void> {
    try {
      await settleAllAdSpend(this.prisma, now);
      await this.prisma.adClick.updateMany({
        where: {
          createdAt: { lt: new Date(now.getTime() - CLICK_IDENTITY_DAYS * 86_400_000) },
          OR: [{ userId: { not: null } }, { visitorId: { not: null } }],
        },
        data: { userId: null, visitorId: null },
      });
    } catch (error) {
      this.logger.warn(`Ad billing sweep failed: ${(error as Error).message}`);
    }
  }

  // ───────────── Showing ads ─────────────

  async serve(query: AdQuery, shopper: Shopper, now = new Date()): Promise<SponsoredProducts> {
    const limit = query.limit ?? DEFAULT_LIMIT[query.placement];
    const context = await this.context(query, shopper);
    if (!context) return { ads: [] };

    const candidates = await this.candidates(context.filter, utcDay(now));
    if (!candidates.length) return { ads: [] };

    const cards = new Map(
      (await this.catalog.cardsByIds([...new Set(candidates.map((c) => c.productId))])).map(
        (card) => [card.id, card],
      ),
    );
    const best = new Map<string, Ranked>();
    for (const candidate of candidates) {
      const card = cards.get(candidate.productId);
      const relevance = context.relevance(candidate.productId);
      if (!card?.inStock || !relevance || context.exclude.has(card.id)) continue;
      const quality = relevance * ratingFactor(card);
      const ranked = { ...candidate, card, quality, adRank: candidate.bidCents * quality };
      const current = best.get(card.id);
      if (!current || ranked.adRank > current.adRank) best.set(card.id, ranked);
    }
    const order = [...best.values()].sort((a, b) => b.adRank - a.adRank);
    const shown = order.slice(0, limit);
    if (!shown.length) return { ads: [] };

    await this.countImpressions(shown, utcDay(now));
    const expiresAt = now.getTime() + AD_TOKEN_TTL_MS;
    return {
      ads: shown.map((ad, i) => ({
        product: ad.card,
        token: this.tokens.sign({
          campaignId: ad.campaignId,
          productId: ad.productId,
          sellerId: ad.sellerId,
          slug: ad.card.slug,
          placement: query.placement,
          costCents: clickPrice(ad, order[i + 1]),
          expiresAt,
        }),
      })),
    };
  }

  /** What makes an ad relevant on this page, or null when the page has no ad slot to fill. */
  private async context(
    query: AdQuery,
    shopper: Shopper,
  ): Promise<{
    filter: { productIds?: string[]; categoryIds?: string[] };
    relevance: (productId: string) => number;
    exclude: Set<string>;
  } | null> {
    switch (query.placement) {
      case 'search': {
        const rank = await this.catalog.searchRank(query.q!, 'ACTIVE');
        const top = Math.max(0, ...rank.values());
        if (!top) return null;
        const scores = new Map(
          [...rank]
            .map(([id, score]) => [id, score / top] as const)
            .filter(([, score]) => score >= MIN_SEARCH_RELEVANCE),
        );
        return {
          filter: { productIds: [...scores.keys()] },
          relevance: (id) => scores.get(id) ?? 0,
          exclude: new Set(),
        };
      }
      case 'category': {
        const categoryIds = await this.catalog.categoryAndDescendantIds(query.category!);
        if (!categoryIds.length) return null;
        return { filter: { categoryIds }, relevance: () => 1, exclude: new Set() };
      }
      case 'product': {
        const product = await this.prisma.product.findFirst({
          where: { slug: query.product!, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!product) return null;
        const ids = await this.recommendations.similarIds(product.id, 12);
        return rankedContext(ids, new Set([product.id]));
      }
      case 'home': {
        const ids = await this.recommendations.affinityIds(shopper, 30);
        return rankedContext(ids.length ? ids : await this.recommendations.popularIds(30));
      }
      default:
        return null;
    }
  }

  /**
   * Live campaigns for these products (or categories) whose store is active, not under fraud
   * review, can pay for at least one click, and whose daily budget is not spent.
   */
  private async candidates(
    filter: { productIds?: string[]; categoryIds?: string[] },
    today: string,
  ): Promise<Candidate[]> {
    const where = filter.productIds
      ? Prisma.sql`cp.product_id = ANY(${filter.productIds}::uuid[])`
      : Prisma.sql`p.category_id = ANY(${filter.categoryIds ?? []}::uuid[])`;
    const rows = await this.prisma.$queryRaw<
      { campaign_id: string; product_id: string; seller_id: string; bid: number; cap: number }[]
    >`
      WITH spent AS (
        SELECT campaign_id, SUM(spend_cents) AS cents FROM ad_daily_stats
        WHERE day = ${today}::date GROUP BY campaign_id
      ),
      funds AS (
        SELECT s.id AS seller_id,
               s.ad_credit_cents
               + COALESCE((SELECT SUM(l.amount_cents) FROM seller_ledger_entries l
                           WHERE l.seller_id = s.id), 0)
               - COALESCE((SELECT SUM(k.cost_cents) FROM ad_clicks k
                           WHERE k.seller_id = s.id AND k.billed_at IS NULL), 0) AS cents
        FROM sellers s
        WHERE s.status = 'ACTIVE' AND NOT s.payouts_held
      )
      SELECT c.id::text AS campaign_id, cp.product_id::text AS product_id,
             c.seller_id::text AS seller_id, c.bid_cents AS bid,
             LEAST(c.daily_budget_cents - COALESCE(sp.cents, 0), f.cents)::int AS cap
      FROM ad_campaigns c
      JOIN ad_campaign_products cp ON cp.campaign_id = c.id
      JOIN products p ON p.id = cp.product_id AND p.status = 'ACTIVE' AND p.seller_id = c.seller_id
      JOIN funds f ON f.seller_id = c.seller_id
      LEFT JOIN spent sp ON sp.campaign_id = c.id
      WHERE c.status = 'ACTIVE'
        AND (c.ends_on IS NULL OR c.ends_on >= ${today}::date)
        AND ${where}
        AND LEAST(c.daily_budget_cents - COALESCE(sp.cents, 0), f.cents) >= ${AD_MIN_BID_CENTS}`;
    return rows.map((row) => ({
      campaignId: row.campaign_id,
      productId: row.product_id,
      sellerId: row.seller_id,
      bidCents: Number(row.bid),
      capCents: Number(row.cap),
    }));
  }

  private async countImpressions(ads: Ranked[], today: string): Promise<void> {
    const values = Prisma.join(
      ads.map(
        (ad) => Prisma.sql`(${ad.campaignId}::uuid, ${ad.productId}::uuid, ${today}::date, 1)`,
      ),
    );
    await this.prisma.$executeRaw`
      INSERT INTO ad_daily_stats (campaign_id, product_id, day, impressions)
      VALUES ${values}
      ON CONFLICT (campaign_id, product_id, day)
      DO UPDATE SET impressions = ad_daily_stats.impressions + 1`.catch((error: Error) =>
      this.logger.warn(`Ad impressions not counted: ${error.message}`),
    );
  }

  // ───────────── Clicks ─────────────

  /**
   * A shopper opened an ad. Always answers with the product to open; charges the store only for
   * a fresh click by an identifiable shopper who is not on the store's own team, within the
   * campaign's daily budget.
   */
  async click(
    token: string,
    shopper: Shopper,
    now = new Date(),
  ): Promise<AdClickResult & { costCents: number }> {
    const ticket = this.tokens.verify(token);
    if (!ticket) throw new BadRequestException('This ad link is not valid.');
    const result = { slug: ticket.slug, costCents: 0 };
    const who = shopper.userId ? { userId: shopper.userId } : { visitorId: shopper.visitorId };
    if (ticket.expiresAt < now.getTime() || (!shopper.userId && !shopper.visitorId)) return result;

    if (shopper.userId) {
      const member = await this.prisma.sellerMember.findFirst({
        where: { userId: shopper.userId, sellerId: ticket.sellerId },
        select: { userId: true },
      });
      if (member) return result;
    }

    const repeat = await this.prisma.adClick.findFirst({
      where: {
        campaignId: ticket.campaignId,
        productId: ticket.productId,
        createdAt: { gt: new Date(now.getTime() - REPEAT_CLICK_MS) },
        OR: [
          ...(shopper.userId ? [{ userId: shopper.userId }] : []),
          ...(shopper.visitorId ? [{ visitorId: shopper.visitorId }] : []),
        ],
      },
      select: { id: true },
    });

    const today = utcDay(now);
    result.costCents = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ads-campaign:${ticket.campaignId}`}))`;
      const campaign = await tx.adCampaign.findUnique({
        where: { id: ticket.campaignId },
        select: { status: true, dailyBudgetCents: true, endsOn: true },
      });
      const live =
        campaign?.status === 'ACTIVE' &&
        (!campaign.endsOn || campaign.endsOn.toISOString().slice(0, 10) >= today);
      let cost = 0;
      if (live && !repeat) {
        const spent = await tx.adDailyStat.aggregate({
          where: { campaignId: ticket.campaignId, day: new Date(`${today}T00:00:00Z`) },
          _sum: { spendCents: true },
        });
        cost = Math.max(
          0,
          Math.min(ticket.costCents, campaign.dailyBudgetCents - (spent._sum.spendCents ?? 0)),
        );
      }
      await tx.adClick.create({
        data: {
          campaignId: ticket.campaignId,
          productId: ticket.productId,
          sellerId: ticket.sellerId,
          placement: ticket.placement,
          costCents: cost,
          ...who,
          // Free clicks have nothing to charge.
          billedAt: cost > 0 ? null : now,
        },
      });
      if (cost > 0) {
        await tx.$executeRaw`
          INSERT INTO ad_daily_stats (campaign_id, product_id, day, clicks, spend_cents)
          VALUES (${ticket.campaignId}::uuid, ${ticket.productId}::uuid, ${today}::date, 1, ${cost})
          ON CONFLICT (campaign_id, product_id, day)
          DO UPDATE SET clicks = ad_daily_stats.clicks + 1,
                        spend_cents = ad_daily_stats.spend_cents + ${cost}`;
      }
      return cost;
    });
    return result;
  }
}

/** Ads for a ranked list of products: the first is the most relevant. */
function rankedContext(ids: string[], exclude = new Set<string>()) {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return {
    filter: { productIds: ids },
    relevance: (id: string) => {
      const at = rank.get(id);
      return at === undefined ? 0 : 1 / (1 + at * 0.08);
    },
    exclude,
  };
}

/** 0.85 for no reviews up to 1.0 for five stars: reviews help, but relevance leads. */
function ratingFactor(card: ProductCard): number {
  const average = card.rating?.count ? (card.rating.average ?? 0) : null;
  return average === null ? 0.92 : 0.85 + 0.03 * average;
}

/**
 * Second price: the least this ad could have bid and still ranked above the next one, plus a
 * cent; the reserve price when nothing is below it. Never above the bid or what it can spend.
 */
export function clickPrice(ad: Ranked, next: Ranked | undefined): number {
  const needed = next ? Math.floor(next.adRank / ad.quality) + 1 : AD_MIN_BID_CENTS;
  return Math.max(AD_MIN_BID_CENTS, Math.min(needed, ad.bidCents, ad.capCents));
}
