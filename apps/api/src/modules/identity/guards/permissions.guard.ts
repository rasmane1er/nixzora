import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STAFF_PERMISSIONS } from '../auth-user';
import { type AuthenticatedRequest, REQUIRED_PERMISSIONS } from './decorators';

/** Deny by default: the caller must hold every permission the route lists. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) return false;

    const missing = required.filter((permission) => !user.permissions.includes(permission));
    if (missing.length) {
      throw new ForbiddenException('You do not have access to this action.');
    }

    if (required.some((permission) => STAFF_PERMISSIONS.has(permission)) && !user.mfaVerified) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'MFA_REQUIRED',
        message: 'Staff actions require two-step verification. Set it up, then sign in again.',
      });
    }
    return true;
  }
}
