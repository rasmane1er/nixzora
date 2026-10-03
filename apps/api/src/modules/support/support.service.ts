import { randomInt } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SUPPORT_TOPIC_LABEL,
  type SupportReply,
  type SupportRequestCreate,
  type SupportRequestView,
} from '@nixzora/validation';
import { type Env } from '../../config/env';
import { type SupportRequest, type SupportStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../identity/auth-user';
import { MailService } from '../notifications/mail.service';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function reference(): string {
  let out = 'S-';
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function toSupportView(row: SupportRequest): SupportRequestView {
  return {
    id: row.id,
    reference: row.reference,
    topic: row.topic,
    email: row.email,
    name: row.name,
    orderNumber: row.orderNumber,
    subject: row.subject,
    message: row.message,
    status: row.status,
    staffReply: row.staffReply,
    pageUrl: row.pageUrl,
    createdAt: row.createdAt.toISOString(),
    answeredAt: row.answeredAt?.toISOString() ?? null,
  };
}

/**
 * Customer support (Help → Contact us, Report a problem): customers write in, get a reference
 * and a confirmation email; staff answer from the Ops Center and the reply is emailed back.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async create(input: SupportRequestCreate, user?: AuthUser): Promise<SupportRequestView> {
    const account = user
      ? await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { email: true, firstName: true, lastName: true },
        })
      : null;
    const email = account?.email ?? input.email;
    if (!email) throw new BadRequestException('Enter your email so we can answer you.');
    const name =
      input.name || [account?.firstName, account?.lastName].filter(Boolean).join(' ') || null;

    let row: SupportRequest | null = null;
    for (let attempt = 0; !row && attempt < 5; attempt++) {
      try {
        row = await this.prisma.supportRequest.create({
          data: {
            reference: reference(),
            userId: user?.id ?? null,
            email,
            name,
            topic: input.topic,
            orderNumber: input.orderNumber ?? null,
            subject: input.subject,
            message: input.message,
            pageUrl: input.pageUrl ?? null,
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }

    await this.mail
      .send({
        to: email,
        subject: `We got your message (${row!.reference})`,
        template: 'support.received',
        data: { reference: row!.reference, subject: row!.subject },
        text: [
          `Hi${name ? ` ${name.split(' ')[0]}` : ''},`,
          '',
          `Thanks for writing to NIXZORA. Your reference is ${row!.reference}.`,
          'We answer within one business day, by email to this address.',
          '',
          `Your message: ${row!.subject}`,
          '',
          '— NIXZORA customer support',
        ].join('\n'),
      })
      .catch(() => undefined);
    const team = this.config.get('SUPPORT_EMAIL', { infer: true });
    if (team) {
      await this.mail
        .send({
          to: team,
          subject: `[${row!.reference}] ${SUPPORT_TOPIC_LABEL[row!.topic]}: ${row!.subject}`,
          template: 'support.new',
          data: { reference: row!.reference },
          text: `${email}${row!.orderNumber ? ` · ${row!.orderNumber}` : ''}\n\n${row!.message}`,
        })
        .catch(() => undefined);
    }
    return toSupportView(row!);
  }

  async forUser(userId: string): Promise<SupportRequestView[]> {
    const rows = await this.prisma.supportRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(toSupportView);
  }

  async list(status?: SupportStatus): Promise<SupportRequestView[]> {
    const rows = await this.prisma.supportRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toSupportView);
  }

  async get(id: string): Promise<SupportRequestView> {
    const row = await this.prisma.supportRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Support request not found.');
    return toSupportView(row);
  }

  /** Staff answer: the reply is saved and emailed to the customer. */
  async reply(
    id: string,
    input: SupportReply,
    actor: { user: AuthUser; meta: Parameters<AuditService['record']>[0]['meta'] },
  ): Promise<SupportRequestView> {
    const current = await this.prisma.supportRequest.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Support request not found.');
    const row = await this.prisma.supportRequest.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.reply ? { staffReply: input.reply, answeredAt: new Date() } : {}),
      },
    });
    if (input.reply) {
      await this.mail.send({
        to: row.email,
        subject: `Re: ${row.subject} (${row.reference})`,
        template: 'support.reply',
        data: { reference: row.reference },
        text: `${input.reply}\n\n— NIXZORA customer support\nReference ${row.reference}`,
      });
    }
    await this.audit.record({
      action: input.reply ? 'support.replied' : 'support.status',
      actorId: actor.user.id,
      entityType: 'support_request',
      entityId: id,
      meta: actor.meta,
      metadata: { reference: row.reference, status: input.status },
    });
    return toSupportView(row);
  }
}
