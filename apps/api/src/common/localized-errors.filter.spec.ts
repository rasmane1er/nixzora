import {
  type ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { type AbstractHttpAdapter } from '@nestjs/core';
import { ERROR_MESSAGE_KEYS, translateErrorMessage } from './error-messages';
import { LocalizedErrorsFilter } from './localized-errors.filter';

/** Runs the filter for one exception and returns the status and body it wrote. */
function respond(exception: HttpException, acceptLanguage?: string) {
  const reply = jest.fn();
  const adapter = { reply, isHeadersSent: () => false } as unknown as AbstractHttpAdapter;
  const request = { headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {} };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
    getArgByIndex: (index: number) => [request, {}][index],
    getArgs: () => [request, {}],
  } as unknown as ArgumentsHost;
  new LocalizedErrorsFilter(adapter).catch(exception, host);
  const [, body, status] = reply.mock.calls[0] as [unknown, Record<string, unknown>, number];
  return { body, status };
}

describe('LocalizedErrorsFilter', () => {
  it('leaves English (and a missing header) byte-identical', () => {
    const error = new UnauthorizedException('Email or password is incorrect.');
    for (const header of [undefined, 'en', 'en-US,en;q=0.9']) {
      expect(respond(error, header)).toEqual({
        status: 401,
        body: {
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Email or password is incorrect.',
        },
      });
    }
  });

  it('translates a known message into French and keeps the other fields', () => {
    const { body, status } = respond(
      new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'COUPON_INVALID',
        message: 'SAVE10: That code has expired. Remove it or try another code.',
      }),
      'fr-FR,fr;q=0.9',
    );
    expect(status).toBe(409);
    expect(body).toEqual({
      statusCode: 409,
      error: 'Conflict',
      code: 'COUPON_INVALID',
      message: 'SAVE10 : Ce code a expiré. Retirez-le ou essayez un autre code.',
    });
  });

  it('translates into Spanish, including messages with values in them', () => {
    expect(respond(new BadRequestException('Your cart is empty.'), 'es').body.message).toBe(
      'Tu carrito está vacío.',
    );
    expect(
      respond(
        new HttpException(
          'Too many failed sign-in attempts. Try again in 15 minutes or reset your password.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
        'es',
      ),
    ).toEqual({
      status: 429,
      body: {
        statusCode: 429,
        message:
          'Demasiados intentos fallidos de inicio de sesión. Vuelve a intentarlo en 15 minutos o restablece tu contraseña.',
      },
    });
  });

  it('translates the top-level validation message but not the Zod issues', () => {
    const issues = [{ field: 'email', message: 'Invalid email address' }];
    const { body } = respond(
      new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Some fields need attention.',
        issues,
      }),
      'fr',
    );
    expect(body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Certains champs sont à vérifier.',
      issues,
    });
  });

  it('passes unknown messages through unchanged', () => {
    const { body } = respond(new NotFoundException('Cannot GET /api/v1/nowhere'), 'fr');
    expect(body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Cannot GET /api/v1/nowhere',
    });
  });
});

describe('translateErrorMessage', () => {
  it('re-formats US dollar amounts and translates nested coupon problems', () => {
    expect(
      translateErrorMessage(
        'WELCOME: Spend $1,050.00 or more to use WELCOME. Remove it or try another code.',
        'es',
      ),
    ).toBe('WELCOME: Gasta $1,050.00 o más para usar WELCOME. Quítalo o prueba otro código.');
    expect(translateErrorMessage('Payouts start at $25.00; available now: $3.10.', 'fr')).toMatch(
      /^Les versements commencent à 25,00\s\$US ; disponible actuellement : 3,10\s\$US\.$/,
    );
  });

  it('maps every fixed English message to one key', () => {
    expect(ERROR_MESSAGE_KEYS.get('Your session has ended. Sign in again.')).toBe('sessionEnded');
    expect(translateErrorMessage('ThrottlerException: Too Many Requests', 'fr')).toBe(
      'Trop de requêtes. Réessayez dans un instant.',
    );
    expect(translateErrorMessage('Something else entirely.', 'es')).toBe(
      'Something else entirely.',
    );
    expect(translateErrorMessage('Your cart is empty.', 'en')).toBe('Your cart is empty.');
  });
});
