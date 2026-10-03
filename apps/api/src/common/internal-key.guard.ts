import { timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Request } from 'express';
import { type Env } from '../config/env';

/** Only callers holding INTERNAL_API_KEY (the API) may use the search service. */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  private readonly key?: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const key = config.get('INTERNAL_API_KEY', { infer: true });
    this.key = key ? Buffer.from(key) : undefined;
  }

  canActivate(context: ExecutionContext): boolean {
    const presented = context.switchToHttp().getRequest<Request>().headers['x-internal-key'];
    const given = Buffer.from(typeof presented === 'string' ? presented : '');
    if (!this.key || given.length !== this.key.length || !timingSafeEqual(given, this.key)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
