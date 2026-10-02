import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request } from 'express';
import { type AuthUser } from '../auth-user';

export const IS_PUBLIC = 'nixzora:isPublic';
export const OPTIONAL_AUTH = 'nixzora:optionalAuth';
export const REQUIRED_PERMISSIONS = 'nixzora:requiredPermissions';

/** Opt a route out of authentication. Every other route requires a valid access token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Open to everyone, but signed-in callers are recognised (e.g. the cart and checkout).
 * A token that is sent but invalid still gets a 401, so clients know to refresh it.
 */
export const OptionalAuth = () =>
  applyDecorators(SetMetadata(IS_PUBLIC, true), SetMetadata(OPTIONAL_AUTH, true));

/** The caller must hold every listed permission. Staff permissions also require MFA. */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

export type AuthenticatedRequest = Request & { user?: AuthUser };

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw new UnauthorizedException();
  return user;
});

/** The signed-in user on an @OptionalAuth() route, or undefined for guests. */
export const MaybeUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
