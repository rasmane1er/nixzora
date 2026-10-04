import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminUser,
  type CustomerNoteView,
  type PagedResult,
  pagedResult,
  type UserListQuery,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { EmailSuppressionService } from '../notifications/email-suppression.service';

const userInclude = {
  roles: { include: { role: true } },
  identities: { select: { provider: true } },
  _count: { select: { sessions: { where: { revokedAt: null } }, passkeys: true } },
} satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

/** Staff tools for accounts: look up users, grant roles, suspend and reactivate. */
@Injectable()
export class UsersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly suppressions: EmailSuppressionService,
  ) {}

  async list(query: UserListQuery): Promise<PagedResult<AdminUser>> {
    const where: Prisma.UserWhereInput = {
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              // Phone numbers are stored as +<digits>: match the digits typed, any format.
              ...(query.q.replace(/\D/g, '').length >= 4
                ? [{ phone: { contains: query.q.replace(/\D/g, '') } }]
                : []),
            ],
          }
        : {}),
      ...(query.role ? { roles: { some: { role: { key: query.role } } } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return pagedResult(rows.map(toAdminUser), total, query);
  }

  async get(id: string): Promise<AdminUser> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user) throw new NotFoundException('User not found.');
    const suppression = await this.suppressions.find(user.email);
    return {
      ...toAdminUser(user),
      emailSuppressed: suppression
        ? {
            reason: suppression.reason,
            at: suppression.createdAt.toISOString(),
            detail: suppression.detail,
          }
        : null,
    };
  }

  /** Emails this customer again: they fixed their mailbox, or the complaint was a mistake. */
  async resumeEmails(userId: string, actor: ActorContext): Promise<AdminUser> {
    const user = await this.get(userId);
    if (await this.suppressions.remove(user.email)) {
      await this.audit.recordFor(actor, 'users.email.resumed', 'user', userId);
    }
    return this.get(userId);
  }

  async grantRole(userId: string, roleKey: string, actor: ActorContext): Promise<AdminUser> {
    await this.get(userId);
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: await this.roleId(roleKey) } },
      create: { user: { connect: { id: userId } }, role: { connect: { key: roleKey } } },
      update: {},
    });
    await this.audit.recordFor(actor, 'users.role.granted', 'user', userId, { roleKey });
    return this.get(userId);
  }

  async revokeRole(userId: string, roleKey: string, actor: ActorContext): Promise<AdminUser> {
    if (userId === actor.user.id && roleKey === 'admin') {
      throw new BadRequestException('You cannot remove your own admin role. Ask another admin.');
    }
    await this.get(userId);
    await this.prisma.userRole.deleteMany({ where: { userId, role: { key: roleKey } } });
    await this.audit.recordFor(actor, 'users.role.revoked', 'user', userId, { roleKey });
    return this.get(userId);
  }

  async setStatus(
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED',
    actor: ActorContext,
  ): Promise<AdminUser> {
    if (userId === actor.user.id)
      throw new BadRequestException('You cannot change your own account status.');
    await this.get(userId);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status } }),
      ...(status === 'SUSPENDED'
        ? [
            this.prisma.session.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]
        : []),
    ]);
    await this.audit.recordFor(
      actor,
      status === 'SUSPENDED' ? 'users.suspended' : 'users.reactivated',
      'user',
      userId,
    );
    return this.get(userId);
  }

  // ───── Customer support ─────

  /** A customer's last 100 orders, newest first. */
  async orders(userId: string) {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      include: { items: { select: { quantity: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      totalCents: order.totalCents,
      refundedCents: order.refundedCents,
      currency: order.currency,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt.toISOString(),
    }));
  }

  async notes(userId: string): Promise<CustomerNoteView[]> {
    const rows = await this.prisma.customerNote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toNoteView);
  }

  async addNote(userId: string, body: string, actor: ActorContext): Promise<CustomerNoteView> {
    await this.get(userId);
    const note = await this.prisma.customerNote.create({
      data: { userId, authorId: actor.user.id, authorEmail: actor.user.email, body },
    });
    await this.audit.recordFor(actor, 'customers.note.added', 'user', userId);
    return toNoteView(note);
  }

  private async roleId(key: string): Promise<string> {
    const role = await this.prisma.role.findUnique({ where: { key } });
    if (!role) throw new BadRequestException('Unknown role.');
    return role.id;
  }
}

function toAdminUser(user: UserRow): AdminUser {
  // The list leaves out the suppression lookup; the detail page (get) fills it in.
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    mfaEnabled: user.mfaEnabled,
    roles: user.roles.map((userRole) => userRole.role.key).sort(),
    activeSessions: user._count.sessions,
    createdAt: user.createdAt.toISOString(),
    phone: user.phone,
    language: user.language,
    marketingEmails: user.marketingEmails,
    termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
    socialSignIns: user.identities.map((identity) => identity.provider).sort(),
    passkeys: user._count.passkeys,
    hasPassword: user.passwordHash !== null,
    emailSuppressed: null,
  };
}

function toNoteView(note: {
  id: string;
  body: string;
  authorEmail: string;
  createdAt: Date;
}): CustomerNoteView {
  return {
    id: note.id,
    body: note.body,
    authorEmail: note.authorEmail,
    createdAt: note.createdAt.toISOString(),
  };
}
