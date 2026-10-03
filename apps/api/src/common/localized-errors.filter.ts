import { type ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { type Request } from 'express';
import { translateErrorBody } from './error-messages';
import { requestLocale } from './locale';

/**
 * Error messages in the caller's language: when Accept-Language asks for French or Spanish, the
 * `message` of an HTTP error is replaced by its translation (see error-messages.ts). English
 * responses, unknown messages and every other field (`code`, `issues`…) are left untouched;
 * the response is then written by Nest's own filter, exactly as before.
 */
@Catch(HttpException)
export class LocalizedErrorsFilter extends BaseExceptionFilter {
  override catch(exception: HttpException, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return super.catch(exception, host);
    const locale = requestLocale(host.switchToHttp().getRequest<Request>());
    const body = exception.getResponse();
    const translated = translateErrorBody(body, locale);
    if (translated === body) return super.catch(exception, host);
    super.catch(new HttpException(translated, exception.getStatus(), { cause: exception }), host);
  }
}
