import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type PaymentCardView } from '@nixzora/validation';
import { type PaymentCard } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payments/payment-gateway';

/** Expired once the last day of its expiry month has passed. */
export function cardExpired(
  card: { expMonth: number; expYear: number },
  now = new Date(),
): boolean {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return card.expYear < year || (card.expYear === year && card.expMonth < month);
}

/** Most saved cards an account keeps; saving another replaces the oldest. */
export const MAX_SAVED_CARDS = 10;

/**
 * Saved cards (p10-09). The payment provider keeps the card on the account's provider customer;
 * NIXZORA copies brand, last four digits and expiry for display and marks one as the default for
 * 1-click. Cards are only saved when the customer ticks "Save this card" while paying.
 */
@Injectable()
export class PaymentCardsService {
  private readonly logger = new Logger(PaymentCardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async list(userId: string): Promise<PaymentCardView[]> {
    const cards = await this.prisma.paymentCard.findMany({
      where: { userId, provider: this.gateway.name },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return cards.map(view);
  }

  /** A usable saved card of this customer's, or 404 / 409 with a reason. */
  async usable(userId: string, id: string): Promise<PaymentCard> {
    const card = await this.prisma.paymentCard.findFirst({
      where: { id, userId, provider: this.gateway.name },
    });
    if (!card) throw new NotFoundException('That saved card is not on your account.');
    if (cardExpired(card)) {
      throw new BadRequestException('That card has expired. Pay with another card.');
    }
    return card;
  }

  /** The provider customer for this account, created (and remembered) on first use. */
  async customerFor(user: { id: string; email: string }): Promise<string> {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { paymentCustomerId: true },
    });
    const id = await this.gateway.ensureCustomer({
      userId: user.id,
      email: user.email,
      existing: row.paymentCustomerId,
    });
    if (id !== row.paymentCustomerId) {
      await this.prisma.user.update({ where: { id: user.id }, data: { paymentCustomerId: id } });
    }
    return id;
  }

  /** After a payment that asked to keep its card: remember the card (the first is the default). */
  async rememberFromPayment(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId: paymentId },
      select: { saveCard: true, order: { select: { userId: true } } },
    });
    const userId = payment?.order.userId;
    if (!payment?.saveCard || !userId) return;
    const card = await this.gateway.savedCard(paymentId);
    if (!card) return;
    const existing = await this.prisma.paymentCard.findMany({
      where: { userId, provider: this.gateway.name },
      orderBy: { createdAt: 'asc' },
    });
    // The same card saved again (same provider method): nothing new.
    if (existing.some((c) => c.providerMethodId === card.methodId)) return;
    const saved = await this.prisma.paymentCard.create({
      data: {
        userId,
        provider: this.gateway.name,
        providerMethodId: card.methodId,
        brand: card.brand,
        last4: card.last4,
        expMonth: card.expMonth,
        expYear: card.expYear,
        isDefault: !existing.some((c) => c.isDefault),
      },
    });
    for (const old of existing.slice(0, Math.max(0, existing.length + 1 - MAX_SAVED_CARDS))) {
      await this.remove(userId, old.id).catch(() => undefined);
    }
    await this.audit.record({
      action: 'payments.card.saved',
      actorId: userId,
      entityType: 'payment_card',
      entityId: saved.id,
      metadata: { brand: card.brand, last4: card.last4 },
    });
  }

  async setDefault(userId: string, id: string): Promise<PaymentCardView[]> {
    await this.usable(userId, id);
    await this.prisma.$transaction([
      this.prisma.paymentCard.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.paymentCard.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.list(userId);
  }

  /** Forgets the card here and at the provider; the next newest becomes the default. */
  async remove(userId: string, id: string): Promise<PaymentCardView[]> {
    const card = await this.prisma.paymentCard.findFirst({ where: { id, userId } });
    if (!card) throw new NotFoundException('That saved card is not on your account.');
    await this.gateway
      .detachCard(card.providerMethodId)
      .catch((error: Error) => this.logger.warn(`Detaching a card failed: ${error.message}`));
    await this.prisma.paymentCard.delete({ where: { id } });
    if (card.isDefault) {
      const next = await this.prisma.paymentCard.findFirst({
        where: { userId, provider: this.gateway.name },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await this.prisma.paymentCard.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
    await this.audit.record({
      action: 'payments.card.removed',
      actorId: userId,
      entityType: 'payment_card',
      entityId: id,
      metadata: { brand: card.brand, last4: card.last4 },
    });
    return this.list(userId);
  }
}

function view(card: PaymentCard): PaymentCardView {
  return {
    id: card.id,
    brand: card.brand,
    last4: card.last4,
    expMonth: card.expMonth,
    expYear: card.expYear,
    isDefault: card.isDefault,
    expired: cardExpired(card),
  };
}
