import { ratingSummary } from '../../common/rating';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Locale } from '@nixzora/i18n';
import {
  type PayoutOnboardingLink,
  type PublicSeller,
  SellerHandleSchema,
  type SellerMeResponse,
  type SellerProfileUpdate,
  type SellerView,
  slugify,
} from '@nixzora/validation';
import { toLocale } from '../../common/locale';
import { type Env } from '../../config/env';
import { type Seller, type SellerMemberRole } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { PAYOUT_GATEWAY, type PayoutGateway } from '../payments/payout-gateway';
import { StorageService } from '../media/storage.service';
import { listingCounts, NO_LISTINGS, toSellerView } from './seller-mappers';

export type SellerContext = { seller: Seller; role: SellerMemberRole };

/**
 * A seller's own account (p7-01): applying, the store profile and payout onboarding.
 * Identity and bank details go straight to the payout provider's hosted forms; NIXZORA stores
 * only the connected account id and whether it is verified.
 */
@Injectable()
export class SellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
    @Inject(PAYOUT_GATEWAY) private readonly payouts: PayoutGateway,
    private readonly storage: StorageService,
  ) {}

  /** The language for emails to the store: its owner's account language. */
  async ownerLocale(sellerId: string): Promise<Locale> {
    const owner = await this.prisma.sellerMember.findFirst({
      where: { sellerId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: { language: true } } },
    });
    return toLocale(owner?.user.language);
  }

  /** The caller's seller membership, or null. */
  async context(userId: string): Promise<SellerContext | null> {
    const member = await this.prisma.sellerMember.findUnique({
      where: { userId },
      include: { seller: true },
    });
    return member ? { seller: member.seller, role: member.role } : null;
  }

  /**
   * The caller's seller. `write` refuses suspended and rejected stores; `owner` limits the
   * action to the account owner (payouts, store profile).
   */
  async require(
    userId: string,
    need: { write?: boolean; owner?: boolean } = {},
  ): Promise<SellerContext> {
    const ctx = await this.context(userId);
    if (!ctx) throw new ForbiddenException('Set up your seller account first.');
    if (need.owner && ctx.role !== 'OWNER') {
      throw new ForbiddenException('Only the store owner can do that.');
    }
    if (need.write && (ctx.seller.status === 'SUSPENDED' || ctx.seller.status === 'REJECTED')) {
      throw new ForbiddenException(
        ctx.seller.status === 'SUSPENDED'
          ? 'Your store is suspended. Contact seller support.'
          : 'Your seller application was not approved.',
      );
    }
    return ctx;
  }

  async me(userId: string): Promise<SellerMeResponse> {
    const ctx = await this.context(userId);
    if (!ctx) return { seller: null, role: null };
    return { seller: await this.view(ctx.seller), role: ctx.role };
  }

  async updateProfile(input: SellerProfileUpdate, actor: ActorContext): Promise<SellerView> {
    const { seller } = await this.require(actor.user.id, { owner: true });
    for (const key of [input.logoKey, input.bannerKey]) {
      if (
        key &&
        key !== seller.logoKey &&
        key !== seller.bannerKey &&
        !(await this.storage.exists(key))
      ) {
        throw new BadRequestException('Upload the image again: we could not find it.');
      }
    }
    const updated = await this.prisma.seller.update({ where: { id: seller.id }, data: input });
    await this.audit.recordFor(
      { ...actor, actorType: 'USER' },
      'seller.profile.updated',
      'seller',
      seller.id,
      { changes: Object.keys(input) },
    );
    return this.view(updated);
  }

  /** Creates the connected account if needed and returns the provider's onboarding link. */
  async startPayoutOnboarding(actor: ActorContext): Promise<PayoutOnboardingLink> {
    let { seller } = await this.require(actor.user.id, { owner: true, write: true });
    // A store verified in test mode gets a real account once Stripe is switched on.
    if (!seller.payoutAccountId || seller.payoutProvider !== this.payouts.name) {
      const { accountId } = await this.payouts.createAccount({
        sellerId: seller.id,
        email: seller.contactEmail,
        country: seller.country,
        businessName: seller.legalName,
      });
      seller = await this.prisma.seller.update({
        where: { id: seller.id },
        data: {
          payoutAccountId: accountId,
          payoutProvider: this.payouts.name,
          detailsSubmitted: false,
          payoutsEnabled: false,
          requirementsDue: [],
        },
      });
      await this.audit.recordFor(
        { ...actor, actorType: 'USER' },
        'seller.payouts.account_created',
        'seller',
        seller.id,
        {
          provider: this.payouts.name,
        },
      );
    }
    const base = this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
    const url = await this.payouts.onboardingLink(seller.payoutAccountId!, {
      returnUrl: `${base}/sell/payouts/return`,
      refreshUrl: `${base}/sell/payouts/start`,
    });
    return { url };
  }

  /** Pulls verification status from the provider (after onboarding, or on demand). */
  async refreshPayouts(actor: ActorContext): Promise<SellerView> {
    const { seller } = await this.require(actor.user.id);
    return this.view(await this.syncPayoutStatus(seller, actor));
  }

  async syncPayoutStatus(seller: Seller, actor?: ActorContext): Promise<Seller> {
    // An account from another provider (test mode before Stripe was switched on) can't be read.
    if (!seller.payoutAccountId || seller.payoutProvider !== this.payouts.name) return seller;
    const status = await this.payouts.accountStatus(seller.payoutAccountId);
    const updated = await this.prisma.seller.update({
      where: { id: seller.id },
      data: status,
    });
    if (status.payoutsEnabled !== seller.payoutsEnabled) {
      await this.audit.record({
        action: status.payoutsEnabled ? 'seller.payouts.enabled' : 'seller.payouts.disabled',
        actorType: actor ? 'USER' : 'SYSTEM',
        actorId: actor?.user.id ?? null,
        entityType: 'seller',
        entityId: seller.id,
        meta: actor?.meta,
      });
    }
    return updated;
  }

  /** The public store page: only approved stores are visible. */
  async publicProfile(handle: string): Promise<PublicSeller> {
    const seller = await this.prisma.seller.findFirst({
      where: { handle, status: 'ACTIVE' },
      include: {
        _count: {
          select: {
            products: { where: { status: 'ACTIVE' } },
            orders: { where: { status: { in: ['SHIPPED', 'DELIVERED'] } } },
          },
        },
      },
    });
    if (!seller) throw new NotFoundException('We could not find that store.');
    const url = (key: string | null) => (key ? this.storage.publicUrl(key) : null);
    return {
      handle: seller.handle,
      displayName: seller.displayName,
      description: seller.description,
      memberSince: (seller.approvedAt ?? seller.createdAt).toISOString(),
      productCount: seller._count.products,
      rating: ratingSummary(seller),
      category: seller.category,
      website: seller.website,
      logoUrl: url(seller.logoKey),
      bannerUrl: url(seller.bannerKey),
      supportEmail: seller.supportEmail,
      salesCount: seller._count.orders,
      handlingDays: seller.handlingDays,
    };
  }

  async view(seller: Seller): Promise<SellerView> {
    const counts = await listingCounts(this.prisma, [seller.id]);
    return toSellerView(
      seller,
      (key) => this.storage.publicUrl(key),
      counts.get(seller.id) ?? NO_LISTINGS,
    );
  }

  /** "Brightline Audio Co." → "brightline-audio-co", or the next free variant of it. */
  async availableHandle(name: string): Promise<string> {
    let base = slugify(name).slice(0, 34).replace(/-+$/, '');
    if (!SellerHandleSchema.safeParse(base).success) base = `${base || 'store'}-shop`.slice(0, 34);
    if (!SellerHandleSchema.safeParse(base).success) base = 'my-shop';
    const taken = new Set(
      (
        await this.prisma.seller.findMany({
          where: { handle: { startsWith: base } },
          select: { handle: true },
        })
      ).map((row) => row.handle),
    );
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}
