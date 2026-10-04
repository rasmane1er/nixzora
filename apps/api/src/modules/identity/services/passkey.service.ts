import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { translator } from '@nixzora/i18n';
import {
  type AuthTokens,
  type PasskeyOptionsResponse,
  type PasskeyRegisterRequest,
  type PasskeySignInRequest,
  type PasskeySummary,
} from '@nixzora/validation';
import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { type Passkey } from '../../../generated/prisma/client';
import { type Env } from '../../../config/env';
import { toLocale } from '../../../common/locale';
import { type RequestMeta } from '../../../common/request-meta';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { MailService } from '../../notifications/mail.service';
import { type AuthUser } from '../auth-user';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

const RP_NAME = 'NIXZORA';
const MAX_PASSKEYS = 20;
const SIGN_IN_EXPIRED = 'This sign-in attempt expired. Start again.';
const NOT_RECOGNIZED = 'We did not recognize that passkey. Try another way to sign in.';
const NOT_CONFIRMED = 'We could not confirm your passkey. Try again.';

/**
 * Passkeys (WebAuthn, ADR-0019): sign in with Touch ID, Face ID, Windows Hello, a phone's
 * fingerprint or a security key. Only the public key is stored; the private key never leaves
 * the person's device or password manager. User verification (the fingerprint, face or device
 * PIN) is required, so a passkey counts as two factors, like a password plus a code.
 */
@Injectable()
export class PasskeyService {
  private readonly logger = new Logger(PasskeyService.name);
  private readonly rpId: string;
  private readonly origins: string[];
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.webAppUrl = config.get('WEB_APP_URL', { infer: true });
    const web = new URL(this.webAppUrl);
    this.rpId = config.get('WEBAUTHN_RP_ID', { infer: true }) ?? web.hostname;
    const origins = config.get('WEBAUTHN_ORIGINS', { infer: true });
    this.origins = origins.length ? origins : [web.origin];
  }

  // ───────────── Adding passkeys (signed in) ─────────────

  async registrationOptions(user: AuthUser): Promise<PasskeyOptionsResponse> {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        passkeys: { select: { credentialId: true, transports: true } },
      },
    });
    const displayName =
      [record.firstName, record.lastName].filter(Boolean).join(' ').trim() || record.email;
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: this.rpId,
      userName: record.email,
      userDisplayName: displayName,
      // The account id, so the person's password manager groups their passkeys under one account.
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: record.passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    return {
      challengeToken: await this.tokens.signPasskeyChallenge({
        purpose: 'register',
        challenge: options.challenge,
        sub: user.id,
        jti: randomUUID(),
      }),
      options: options as unknown as Record<string, unknown>,
    };
  }

  async register(
    user: AuthUser,
    input: PasskeyRegisterRequest,
    meta: RequestMeta,
  ): Promise<PasskeySummary> {
    const claims = await this.tokens.verifyPasskeyChallenge(input.challengeToken);
    if (!claims || claims.purpose !== 'register' || claims.sub !== user.id) {
      throw new BadRequestException(SIGN_IN_EXPIRED);
    }
    if ((await this.prisma.passkey.count({ where: { userId: user.id } })) >= MAX_PASSKEYS) {
      throw new BadRequestException('You have the maximum number of passkeys. Remove one first.');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: input.credential as unknown as RegistrationResponseJSON,
        expectedChallenge: claims.challenge,
        expectedOrigin: this.origins,
        expectedRPID: this.rpId,
        requireUserVerification: true,
      });
    } catch (error) {
      this.logger.debug(`Passkey registration rejected: ${(error as Error).message}`);
      throw new BadRequestException(NOT_CONFIRMED);
    }
    if (!verification.verified) throw new BadRequestException(NOT_CONFIRMED);
    await this.useChallenge(claims.jti);

    const info = verification.registrationInfo;
    const exists = await this.prisma.passkey.findUnique({
      where: { credentialId: info.credential.id },
    });
    if (exists) throw new ConflictException('This passkey is already on your account.');

    const passkey = await this.prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: info.credential.id,
        publicKey: Buffer.from(info.credential.publicKey),
        counter: BigInt(info.credential.counter),
        transports: info.credential.transports ?? [],
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        name: input.name ?? deviceLabel(meta.userAgent),
      },
    });
    await this.audit.record({
      action: 'auth.passkey.added',
      actorId: user.id,
      entityType: 'passkey',
      entityId: passkey.id,
      meta,
      metadata: { name: passkey.name, synced: passkey.backedUp },
    });
    await this.notifyAdded(user.id, passkey.name);
    return summary(passkey);
  }

  async list(userId: string): Promise<PasskeySummary[]> {
    const passkeys = await this.prisma.passkey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return passkeys.map(summary);
  }

  async rename(userId: string, id: string, name: string): Promise<PasskeySummary> {
    const passkey = await this.prisma.passkey.findFirst({ where: { id, userId } });
    if (!passkey) throw new NotFoundException('Passkey not found.');
    return summary(await this.prisma.passkey.update({ where: { id }, data: { name } }));
  }

  async remove(user: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    const { count } = await this.prisma.passkey.deleteMany({ where: { id, userId: user.id } });
    if (!count) throw new NotFoundException('Passkey not found.');
    await this.audit.record({
      action: 'auth.passkey.removed',
      actorId: user.id,
      entityType: 'passkey',
      entityId: id,
      meta,
    });
  }

  // ───────────── Signing in ─────────────

  /** No email needed: the browser offers the passkeys it has for this site. */
  async signInOptions(): Promise<PasskeyOptionsResponse> {
    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'required',
      allowCredentials: [],
    });
    return {
      challengeToken: await this.tokens.signPasskeyChallenge({
        purpose: 'sign-in',
        challenge: options.challenge,
        jti: randomUUID(),
      }),
      options: options as unknown as Record<string, unknown>,
    };
  }

  async signIn(input: PasskeySignInRequest, meta: RequestMeta): Promise<AuthTokens> {
    const claims = await this.tokens.verifyPasskeyChallenge(input.challengeToken);
    if (!claims || claims.purpose !== 'sign-in') throw new UnauthorizedException(SIGN_IN_EXPIRED);

    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId: input.credential.id },
      include: { user: { select: { id: true, status: true } } },
    });
    if (!passkey || passkey.user.status !== 'ACTIVE') {
      await this.audit.record({
        action: 'auth.passkey.sign_in_failed',
        actorId: passkey?.userId ?? null,
        meta,
        metadata: { reason: passkey ? 'inactive' : 'unknown_credential' },
      });
      throw new UnauthorizedException(NOT_RECOGNIZED);
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: input.credential as unknown as AuthenticationResponseJSON,
        expectedChallenge: claims.challenge,
        expectedOrigin: this.origins,
        expectedRPID: this.rpId,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: Number(passkey.counter),
          transports: passkey.transports as AuthenticatorTransport[],
        },
        requireUserVerification: true,
      });
    } catch (error) {
      this.logger.debug(`Passkey sign-in rejected: ${(error as Error).message}`);
      await this.audit.record({
        action: 'auth.passkey.sign_in_failed',
        actorId: passkey.userId,
        meta,
        metadata: { reason: 'verification' },
      });
      throw new UnauthorizedException(NOT_CONFIRMED);
    }
    if (!verification.verified) throw new UnauthorizedException(NOT_CONFIRMED);
    await this.useChallenge(claims.jti);

    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        backedUp: verification.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date(),
      },
    });
    const issued = await this.sessions.create({
      userId: passkey.userId,
      meta,
      deviceName: input.deviceName,
      mfaVerified: true,
    });
    await this.audit.record({
      action: 'auth.login.succeeded',
      actorId: passkey.userId,
      entityType: 'session',
      entityId: issued.session.id,
      meta,
      metadata: { method: 'passkey', passkeyId: passkey.id },
    });
    // RFC 8176: "hwk" (proof of a hardware-held key) plus "user" (fingerprint, face or PIN).
    return this.tokens.authTokens(issued.session, issued.refreshToken, ['hwk', 'user']);
  }

  // ───────────── Helpers ─────────────

  /**
   * A challenge works once. Redis remembers used ones until they expire anyway; without Redis
   * this check is skipped (the five-minute expiry and origin binding still apply).
   */
  private async useChallenge(jti: string): Promise<void> {
    let fresh: string | null;
    try {
      fresh = await this.redis.client.set(`passkey:used:${jti}`, '1', 'EX', 360, 'NX');
    } catch (error) {
      this.logger.warn(`Could not record a used passkey challenge: ${(error as Error).message}`);
      return;
    }
    if (fresh !== 'OK') throw new UnauthorizedException(SIGN_IN_EXPIRED);
  }

  private async notifyAdded(userId: string, name: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, language: true },
    });
    if (!user) return;
    const t = translator(toLocale(user.language))('email');
    const link = `${this.webAppUrl}/account/security`;
    await this.mail.trySend({
      to: user.email,
      subject: t('auth_signin_added_subject'),
      text: t('auth_signin_added_text', { method: t('auth_method_passkey'), name, link }),
      template: 'auth.sign-in-method-added',
      data: { method: 'passkey', name, link },
    });
  }
}

function summary(passkey: Passkey): PasskeySummary {
  return {
    id: passkey.id,
    name: passkey.name,
    synced: passkey.backedUp,
    createdAt: passkey.createdAt.toISOString(),
    lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null,
  };
}

/** "Chrome on macOS", "Safari on iPhone"… from the browser's user agent. */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Windows/.test(ua)
            ? 'Windows'
            : /CrOS/.test(ua)
              ? 'ChromeOS'
              : /Linux/.test(ua)
                ? 'Linux'
                : null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /(Chrome|CriOS)\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? 'Passkey';
}
