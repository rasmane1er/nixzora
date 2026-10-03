import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type PayoutOnboardingLink,
  type PublicSeller,
  type SellerApplication,
  SellerHandleSchema,
  type SellerMeResponse,
  type SellerProfileUpdate,
  type SellerView,
  slugify,
} from '@nixzora/validation';
import { type Env } from '../../config/env';
import { isUniqueViolation } from '../../common/prisma-errors';
import { type Seller, type SellerMemberRole } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { PAYOUT_GATEWAY, type PayoutGateway } from '../payments/payout-gateway';
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
  ) {}

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

  async apply(input: SellerApplication, actor: ActorContext): Promise<SellerView> {
    if (await this.context(actor.user.id)) {
      throw new ConflictException('You already have a seller account.');
    }
    const handle = input.handle ?? (await this.availableHandle(input.displayName));
    try {
      const seller = await this.prisma.$transaction(async (tx) => {
        const created = await tx.seller.create({
          data: {
            handle,
            displayName: input.displayName,
            legalName: input.legalName,
            contactEmail: input.contactEmail ?? actor.user.email,
            country: input.country,
            description: input.description ?? null,
            members: { create: { userId: actor.user.id, role: 'OWNER' } },
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'seller',
            aggregateId: created.id,
            type: 'seller.applied',
            payload: { sellerId: created.id, handle },
          },
        });
        return created;
      });
      await this.record('seller.applied', seller.id, actor, { handle });
      return this.view(seller);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          input.handle
            ? 'That store address is taken. Choose another.'
            : 'You already have a seller account.',
        );
      }
      throw error;
    }
  }

  async updateProfile(input: SellerProfileUpdate, actor: ActorContext): Promise<SellerView> {
    const { seller } = await this.require(actor.user.id, { owner: true });
    const updated = await this.prisma.seller.update({ where: { id: seller.id }, data: input });
    await this.record('seller.profile.updated', seller.id, actor, { changes: Object.keys(input) });
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
      await this.record('seller.payouts.account_created', seller.id, actor, {
        provider: this.payouts.name,
      });
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
      include: { _count: { select: { products: { where: { status: 'ACTIVE' } } } } },
    });
    if (!seller) throw new NotFoundException('We could not find that store.');
    return {
      handle: seller.handle,
      displayName: seller.displayName,
      description: seller.description,
      memberSince: (seller.approvedAt ?? seller.createdAt).toISOString(),
      productCount: seller._count.products,
    };
  }

  async view(seller: Seller): Promise<SellerView> {
    const counts = await listingCounts(this.prisma, [seller.id]);
    return toSellerView(seller, counts.get(seller.id) ?? NO_LISTINGS);
  }

  /** "Brightline Audio Co." → "brightline-audio-co", or the next free variant of it. */
  private async availableHandle(name: string): Promise<string> {
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

  private record(
    action: string,
    sellerId: string,
    actor: ActorContext,
    metadata?: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      actorType: 'USER',
      actorId: actor.user.id,
      entityType: 'seller',
      entityId: sellerId,
      meta: actor.meta,
      metadata,
    });
  }
}
