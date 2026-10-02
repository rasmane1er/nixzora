import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Session } from '../../../generated/prisma/client';
import { type Env } from '../../../config/env';
import { randomToken, sha256 } from '../../../common/crypto';
import { type RequestMeta } from '../../../common/request-meta';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

export type IssuedSession = { session: Session; refreshToken: string };

const SESSION_ENDED = 'Your session has ended. Sign in again.';

/**
 * One row per signed-in device. The refresh token is opaque, stored only as a hash,
 * and rotated on every use. Presenting an already-rotated token revokes the session,
 * because it means two parties hold the same token (theft or replay).
 */
@Injectable()
export class SessionService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400_000;
  }

  async create(input: {
    userId: string;
    meta: RequestMeta;
    deviceName?: string;
    mfaVerified: boolean;
  }): Promise<IssuedSession> {
    const refreshToken = randomToken();
    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        refreshTokenHash: sha256(refreshToken),
        deviceName: input.deviceName ?? null,
        userAgent: input.meta.userAgent,
        ipAddress: input.meta.ipAddress,
        expiresAt: new Date(Date.now() + this.ttlMs),
        mfaVerifiedAt: input.mfaVerified ? new Date() : null,
      },
    });
    return { session, refreshToken };
  }

  async rotate(refreshToken: string, meta: RequestMeta): Promise<IssuedSession> {
    const presentedHash = sha256(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: presentedHash },
      include: { user: { select: { status: true } } },
    });

    if (!session) {
      await this.handlePossibleReuse(presentedHash, meta);
      throw new UnauthorizedException(SESSION_ENDED);
    }
    if (session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException(SESSION_ENDED);
    }

    const nextToken = randomToken();
    // Conditional update: if two requests race with the same token, only one wins.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: presentedHash, revokedAt: null },
      data: {
        previousRefreshTokenHash: presentedHash,
        refreshTokenHash: sha256(nextToken),
        lastUsedAt: new Date(),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
    if (count !== 1) throw new UnauthorizedException(SESSION_ENDED);

    const updated = await this.prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    return { session: updated, refreshToken: nextToken };
  }

  private async handlePossibleReuse(presentedHash: string, meta: RequestMeta): Promise<void> {
    const reused = await this.prisma.session.findUnique({
      where: { previousRefreshTokenHash: presentedHash },
    });
    if (!reused || reused.revokedAt) return;

    await this.prisma.session.update({
      where: { id: reused.id },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      action: 'auth.refresh.reuse_detected',
      actorId: reused.userId,
      entityType: 'session',
      entityId: reused.id,
      meta,
      metadata: { response: 'session_revoked' },
    });
  }

  async revoke(sessionId: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count === 1;
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    const { count } = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  listActive(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }
}
