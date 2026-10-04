import { Injectable, Logger } from '@nestjs/common';
import { type EmailSuppressionReason } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Addresses we stop emailing after SES reports a permanent bounce or a spam complaint (p9-02).
 * Sending to them again hurts the sending reputation every other customer's receipts rely on.
 */
@Injectable()
export class EmailSuppressionService {
  private readonly logger = new Logger(EmailSuppressionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async isSuppressed(email: string): Promise<boolean> {
    const row = await this.prisma.emailSuppression.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { email: true },
    });
    return Boolean(row);
  }

  async find(email: string) {
    return this.prisma.emailSuppression.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  /** Records feedback. A complaint replaces a bounce (it is the stronger signal), not the reverse. */
  async suppress(
    addresses: string[],
    reason: EmailSuppressionReason,
    detail: string | null,
    template: string | null = null,
  ): Promise<number> {
    let added = 0;
    for (const email of addresses) {
      const existing = await this.prisma.emailSuppression.findUnique({ where: { email } });
      if (existing && (existing.reason === 'COMPLAINT' || reason === 'BOUNCE')) continue;
      await this.prisma.emailSuppression.upsert({
        where: { email },
        create: { email, reason, detail },
        update: { reason, detail, createdAt: new Date() },
      });
      added++;
      await this.audit.record({
        action: reason === 'BOUNCE' ? 'email.bounced' : 'email.complained',
        entityType: 'email',
        entityId: email,
        metadata: { detail, template },
      });
    }
    if (added) this.logger.warn(`Stopped emailing ${added} address(es) after an SES ${reason}.`);
    return added;
  }

  /** Staff confirmed the customer fixed their mailbox (or the complaint was a mistake). */
  async remove(email: string): Promise<boolean> {
    const result = await this.prisma.emailSuppression.deleteMany({
      where: { email: email.trim().toLowerCase() },
    });
    return result.count > 0;
  }
}
