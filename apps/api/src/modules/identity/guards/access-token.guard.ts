import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenService } from '../services/token.service';
import { type AuthenticatedRequest, IS_PUBLIC, OPTIONAL_AUTH } from './decorators';

/**
 * Global guard: every route needs a valid access token unless marked @Public().
 * Besides the JWT signature, it checks the session and account in the database on each request,
 * so signing out, revoking a device or suspending an account takes effect immediately.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH, targets);
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;

    if (isPublic && !(optional && header)) return true;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Sign in to continue.');
    }

    const claims = await this.tokens.verifyAccessToken(header.slice('Bearer '.length).trim());
    if (!claims) throw new UnauthorizedException('Your session has expired. Sign in again.');

    const session = await this.prisma.session.findUnique({
      where: { id: claims.sid },
      include: {
        user: {
          include: {
            roles: {
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }

    const roles = session.user.roles.map((userRole) => userRole.role.key);
    const permissions = new Set(
      session.user.roles.flatMap((userRole) =>
        userRole.role.permissions.map((rolePermission) => rolePermission.permission.key),
      ),
    );

    req.user = {
      id: session.user.id,
      email: session.user.email,
      sessionId: session.id,
      roles,
      permissions: [...permissions].sort(),
      mfaEnabled: session.user.mfaEnabled,
      mfaVerified: session.mfaVerifiedAt !== null,
    };
    return true;
  }
}
