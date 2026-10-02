import { isIP } from 'node:net';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type Request } from 'express';
import { safeEqual } from './crypto';

export type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

let internalKey: string | undefined;

/**
 * The storefront and Ops Center call the API from their servers, so the TCP peer is the web app,
 * not the shopper. They send the shopper's IP and user agent in X-Client-IP / X-Client-User-Agent,
 * signed with the shared internal key; only then are those headers believed. Everyone else
 * (the mobile app, scripts) is identified by `req.ip`, which Express derives from the load
 * balancer's X-Forwarded-For (TRUST_PROXY_HOPS).
 */
export function setInternalApiKey(key: string | undefined): void {
  internalKey = key;
}

function fromTrustedApp(req: Request): boolean {
  const presented = req.headers['x-internal-key'];
  return Boolean(internalKey && typeof presented === 'string' && safeEqual(presented, internalKey));
}

export function requestMetaFrom(req: Request): RequestMeta {
  const trusted = fromTrustedApp(req);
  const forwardedIp = req.headers['x-client-ip'];
  const forwardedAgent = req.headers['x-client-user-agent'];
  const ipAddress =
    trusted && typeof forwardedIp === 'string' && isIP(forwardedIp.trim())
      ? forwardedIp.trim()
      : (req.ip ?? null);
  const userAgent =
    trusted && typeof forwardedAgent === 'string' ? forwardedAgent : req.headers['user-agent'];
  return {
    ipAddress,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 500) : null,
  };
}

/** Client IP and user agent, recorded on sessions and audit events. */
export const ReqMeta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta =>
  requestMetaFrom(ctx.switchToHttp().getRequest<Request>()),
);
