import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { requestMetaFrom, type RequestMeta } from '../../../common/request-meta';
import { type AuthUser } from '../auth-user';
import { type AuthenticatedRequest } from './decorators';

export type ActorContext = { user: AuthUser; meta: RequestMeta };

/** The signed-in user plus IP and user agent: everything an audited admin action needs. */
export const Actor = createParamDecorator((_: unknown, ctx: ExecutionContext): ActorContext => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!req.user) throw new UnauthorizedException();
  return { user: req.user, meta: requestMetaFrom(req) };
});
