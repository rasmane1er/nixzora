import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { translator } from '@nixzora/i18n';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { OutboxService } from '../outbox/outbox.service';
import { SellersService } from './sellers.service';

type Change = 'applied' | 'approved' | 'reinstated' | 'rejected' | 'suspended';

/**
 * Emails a store owner about their application: received, approved, rejected, and later
 * paused or reopened. The seller portal promises "we'll email you when your application has
 * been reviewed"; these keep that promise. Sent from outbox events, after the change commits.
 */
@Injectable()
export class SellerStatusEmails implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellers: SellersService,
    private readonly outbox: OutboxService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    this.outbox.on('seller.applied', ({ aggregateId }) => this.send(aggregateId, 'applied'));
    this.outbox.on('seller.status.active', ({ aggregateId, payload }) =>
      this.send(aggregateId, payload.from === 'SUSPENDED' ? 'reinstated' : 'approved'),
    );
    this.outbox.on('seller.status.rejected', ({ aggregateId }) =>
      this.send(aggregateId, 'rejected'),
    );
    this.outbox.on('seller.status.suspended', ({ aggregateId }) =>
      this.send(aggregateId, 'suspended'),
    );
  }

  private get webUrl(): string {
    return this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
  }

  async send(sellerId: string, change: Change): Promise<void> {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) return;
    const t = translator(await this.sellers.ownerLocale(sellerId))('email');
    const store = seller.displayName;
    const link = `${this.webUrl}/sell`;
    const storeLink = `${this.webUrl}/s/${seller.handle}`;
    const reason = seller.statusReason?.trim()
      ? t('seller_reason', { reason: seller.statusReason.trim() })
      : '';
    const vars = { store, link, storeLink, reason };
    await this.mail.trySend({
      to: seller.contactEmail,
      subject: t(`seller_${change}_subject`, vars),
      text: t(`seller_${change}_text`, vars),
      template: `sellers.${change}`,
      data: { store, link },
    });
  }
}
