import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatters, translator } from '@nixzora/i18n';
import {
  REFERRAL_CLAIM_DAYS,
  REFERRAL_CODE_DAYS,
  REFERRAL_FRIEND_CENTS,
  REFERRAL_MIN_ORDER_CENTS,
  REFERRAL_REWARD_CENTS,
  REFERRAL_YEARLY_LIMIT,
  type ReferralInvite,
  type ReferralInvitePreview,
  type ReferralView,
} from '@nixzora/validation';
import { toLocale } from '../../common/locale';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { OutboxService } from '../outbox/outbox.service';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DAY_MS = 86_400_000;
/** Invites one person can have pending or used in a year (rewards are capped lower). */
const YEARLY_INVITES = 50;

function random(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

type AddressLike = { line1?: unknown; postalCode?: unknown } | null;

/** "1 Main St., Apt 2" and "1 main st apt 2" are the same door. */
function household(address: AddressLike): string | null {
  if (!address || typeof address.line1 !== 'string' || typeof address.postalCode !== 'string') {
    return null;
  }
  const street = address.line1.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${street}|${address.postalCode.slice(0, 5)}`;
}

/**
 * Refer a friend (p10-23, ADR-0045). A new account enters a friend's code (from their invite
 * link) and gets a one-time welcome code; the friend who invited them gets store credit on the
 * gift card balance when that new customer's first qualifying order ships. Not for the same
 * household, and at most REFERRAL_YEARLY_LIMIT rewards a year.
 */
@Injectable()
export class ReferralsService implements OnModuleInit {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    for (const event of ['order.shipped', 'order.delivered'] as const) {
      this.outbox.on(event, ({ aggregateId }) => this.settle(aggregateId));
    }
  }

  /** The customer's code, made on first use: a few letters of their name and random ones. */
  private async codeFor(userId: string): Promise<string> {
    const existing = await this.prisma.referralCode.findUnique({ where: { userId } });
    if (existing) return existing.code;
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true },
    });
    const prefix = (user.firstName ?? '')
      .normalize('NFD')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 5);
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = `${prefix}${random(prefix.length >= 3 ? 4 : 7 - prefix.length)}`;
      try {
        return (await this.prisma.referralCode.create({ data: { userId, code } })).code;
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        // Two requests at once made one already, or the code is taken: look again.
        const made = await this.prisma.referralCode.findUnique({ where: { userId } });
        if (made) return made.code;
      }
    }
    throw new ConflictException('Could not make an invite code. Try again.');
  }

  async view(userId: string): Promise<ReferralView> {
    const code = await this.codeFor(userId);
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const [made, mine, user] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { referred: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.referral.findUnique({ where: { referredId: userId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } }),
    ]);
    const welcomeCoupon = mine?.couponCode
      ? await this.prisma.coupon.findUnique({ where: { code: mine.couponCode } })
      : null;
    const invites: ReferralInvite[] = made.map((r) => ({
      name: r.referred.firstName
        ? `${r.referred.firstName}${r.referred.lastName ? ` ${r.referred.lastName[0]}.` : ''}`
        : null,
      status: r.status,
      reason: (r.reason as ReferralInvite['reason']) ?? null,
      joinedAt: r.createdAt.toISOString(),
      rewardedAt: r.rewardedAt?.toISOString() ?? null,
    }));
    return {
      code,
      link: `${this.config.get('WEB_APP_URL', { infer: true })}/r/${code}`,
      friendCents: REFERRAL_FRIEND_CENTS,
      rewardCents: REFERRAL_REWARD_CENTS,
      minOrderCents: REFERRAL_MIN_ORDER_CENTS,
      yearlyLimit: REFERRAL_YEARLY_LIMIT,
      rewardedThisYear: made.filter(
        (r) => r.status === 'REWARDED' && r.rewardedAt && r.rewardedAt >= yearStart,
      ).length,
      earnedCents: made.reduce((sum, r) => sum + r.rewardCents, 0),
      invites,
      welcome:
        welcomeCoupon && mine
          ? {
              code: welcomeCoupon.code,
              amountCents: welcomeCoupon.value,
              endsAt: (welcomeCoupon.endsAt ?? new Date()).toISOString(),
              used: welcomeCoupon.redemptionCount > 0,
            }
          : null,
      canClaim: !mine && (await this.isNew(userId, user.createdAt)),
    };
  }

  /** Just the welcome code (for the cart), without making an invite code for the shopper. */
  async welcome(userId: string): Promise<ReferralView['welcome']> {
    const mine = await this.prisma.referral.findUnique({ where: { referredId: userId } });
    if (!mine?.couponCode) return null;
    const coupon = await this.prisma.coupon.findUnique({ where: { code: mine.couponCode } });
    if (!coupon) return null;
    return {
      code: coupon.code,
      amountCents: coupon.value,
      endsAt: (coupon.endsAt ?? new Date()).toISOString(),
      used: coupon.redemptionCount > 0,
    };
  }

  /** The invite page: who invited you (first name only) and what you get. */
  async preview(code: string): Promise<ReferralInvitePreview> {
    const row = await this.prisma.referralCode.findUnique({
      where: { code },
      include: { user: { select: { firstName: true } } },
    });
    if (!row) throw new NotFoundException('That invite link isn’t valid.');
    return {
      firstName: row.user.firstName,
      friendCents: REFERRAL_FRIEND_CENTS,
      minOrderCents: REFERRAL_MIN_ORDER_CENTS,
    };
  }

  /** A new account enters (or arrives with) a friend's code. */
  async claim(userId: string, code: string): Promise<ReferralView> {
    const owner = await this.prisma.referralCode.findUnique({ where: { code } });
    if (!owner) throw new NotFoundException('That invite code isn’t valid.');
    if (owner.userId === userId) {
      throw new BadRequestException('That’s your own invite code. Share it with friends instead.');
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { createdAt: true },
    });
    if (await this.prisma.referral.findUnique({ where: { referredId: userId } })) {
      throw new ConflictException('You’ve already used an invite code.');
    }
    if (!(await this.isNew(userId, user.createdAt))) {
      throw new ConflictException(
        `Invite codes are for new accounts: within ${REFERRAL_CLAIM_DAYS} days of signing up, before a first order.`,
      );
    }
    const yearAgo = new Date(Date.now() - 365 * DAY_MS);
    const recent = await this.prisma.referral.count({
      where: { referrerId: owner.userId, createdAt: { gte: yearAgo } },
    });
    if (recent >= YEARLY_INVITES) {
      throw new ConflictException('That invite code has been used too many times this year.');
    }
    const couponCode = `FRIEND${random(6)}`;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.coupon.create({
          data: {
            code: couponCode,
            description: 'Welcome from a friend',
            type: 'FIXED',
            value: REFERRAL_FRIEND_CENTS,
            minSubtotalCents: REFERRAL_MIN_ORDER_CENTS,
            maxRedemptions: 1,
            endsAt: new Date(Date.now() + REFERRAL_CODE_DAYS * DAY_MS),
          },
        });
        await tx.referral.create({
          data: { referrerId: owner.userId, referredId: userId, couponCode },
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('You’ve already used an invite code.');
      }
      throw error;
    }
    return this.view(userId);
  }

  /** Signed up recently and hasn't paid for an order yet. */
  private async isNew(userId: string, createdAt: Date): Promise<boolean> {
    if (Date.now() - createdAt.getTime() > REFERRAL_CLAIM_DAYS * DAY_MS) return false;
    const paid = await this.prisma.order.count({ where: { userId, placedAt: { not: null } } });
    return paid === 0;
  }

  /**
   * An order shipped (or was delivered): if it's the first qualifying order of someone who was
   * invited, reward the person who invited them. Safe to run twice and for any order.
   */
  async settle(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        kind: true,
        status: true,
        subtotalCents: true,
        discountCents: true,
        shippingAddress: true,
      },
    });
    if (!order?.userId || order.kind !== 'GOODS') return;
    if (!['SHIPPED', 'DELIVERED'].includes(order.status)) return;
    const referral = await this.prisma.referral.findUnique({
      where: { referredId: order.userId },
    });
    if (!referral || referral.status !== 'PENDING') return;
    // A small order doesn't count; a later, bigger one still can.
    if (order.subtotalCents - order.discountCents < REFERRAL_MIN_ORDER_CENTS) return;

    const reject = (reason: 'SAME_HOUSEHOLD' | 'YEARLY_LIMIT') =>
      this.prisma.referral.updateMany({
        where: { id: referral.id, status: 'PENDING' },
        data: { status: 'REJECTED', reason, orderId: order.id },
      });

    // Not for yourself under another email: the friend's parcel can't go to the inviter's door.
    const door = household(order.shippingAddress as AddressLike);
    const [addresses, theirOrders] = await Promise.all([
      this.prisma.address.findMany({ where: { userId: referral.referrerId } }),
      this.prisma.order.findMany({
        where: { userId: referral.referrerId },
        select: { shippingAddress: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    const inviterDoors = new Set(
      [
        ...addresses.map((a) => household(a as unknown as AddressLike)),
        ...theirOrders.map((o) => household(o.shippingAddress as AddressLike)),
      ].filter(Boolean),
    );
    if (door && inviterDoors.has(door)) {
      await reject('SAME_HOUSEHOLD');
      return;
    }

    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const rewarded = await this.prisma.referral.count({
      where: {
        referrerId: referral.referrerId,
        status: 'REWARDED',
        rewardedAt: { gte: yearStart },
      },
    });
    if (rewarded >= REFERRAL_YEARLY_LIMIT) {
      await reject('YEARLY_LIMIT');
      return;
    }

    const done = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.referral.updateMany({
        where: { id: referral.id, status: 'PENDING' },
        data: {
          status: 'REWARDED',
          orderId: order.id,
          rewardCents: REFERRAL_REWARD_CENTS,
          rewardedAt: new Date(),
        },
      });
      if (!claimed.count) return false;
      await tx.giftBalanceEntry.create({
        data: {
          userId: referral.referrerId,
          kind: 'REFERRAL',
          amountCents: REFERRAL_REWARD_CENTS,
          note: 'Refer a friend',
        },
      });
      return true;
    });
    if (done) await this.tellInviter(referral.referrerId, referral.referredId);
  }

  private async tellInviter(referrerId: string, referredId: string): Promise<void> {
    const [inviter, friend] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: referrerId },
        select: { email: true, language: true },
      }),
      this.prisma.user.findUnique({ where: { id: referredId }, select: { firstName: true } }),
    ]);
    if (!inviter) return;
    const locale = toLocale(inviter.language);
    const t = translator(locale)('email');
    const amount = formatters(locale).money(REFERRAL_REWARD_CENTS);
    const vars = {
      amount,
      friend: friend?.firstName ?? t('referral_aFriend'),
      link: `${this.config.get('WEB_APP_URL', { infer: true })}/account/referrals`,
    };
    await this.mail
      .send({
        to: inviter.email,
        subject: t('referral_reward_subject', vars),
        text: t('referral_reward_text', vars),
        template: 'referrals.reward',
        data: { amount },
      })
      .catch((error: Error) => this.logger.warn(`Referral email failed: ${error.message}`));
  }
}
