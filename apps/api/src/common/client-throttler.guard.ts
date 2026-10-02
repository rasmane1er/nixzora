import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { type Request } from 'express';
import { requestMetaFrom } from './request-meta';

/**
 * Rate limits per shopper, not per web server: requests relayed by the storefront or Ops Center
 * count against the shopper's own IP (see requestMetaFrom).
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(requestMetaFrom(req as unknown as Request).ipAddress ?? 'unknown');
  }
}
