import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { DEFAULT_LOCALE, isLocale, type Locale, matchLocale } from '@nixzora/i18n';
import { type Request } from 'express';

/** A stored language ("en", "fr", "es"), or English when it is missing or unknown. */
export function toLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The caller's language from Accept-Language (the website and the app send en, fr or es). */
export function requestLocale(req: Pick<Request, 'headers'>): Locale {
  const header = req.headers['accept-language'];
  return matchLocale(typeof header === 'string' ? header : undefined);
}

/** The caller's language, for emails sent while handling the request (guest checkout, support). */
export const ReqLocale = createParamDecorator((_: unknown, ctx: ExecutionContext): Locale =>
  requestLocale(ctx.switchToHttp().getRequest<Request>()),
);
