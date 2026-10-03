import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AuthTokens,
  type ChangePasswordRequest,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type RegisterRequest,
  type SocialProvider,
  type SocialSignInRequest,
} from '@nixzora/validation';
import {
  type IdentityProvider,
  type Session,
  type User,
  type VerificationPurpose,
} from '../../../generated/prisma/client';
import { type Env } from '../../../config/env';
import { randomToken, sha256 } from '../../../common/crypto';
import { type RequestMeta } from '../../../common/request-meta';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { MailService } from '../../notifications/mail.service';
import { type AuthUser } from '../auth-user';
import { LoginThrottleService } from './login-throttle.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { label, SocialIdentityService } from './social-identity.service';
import { TokenService } from './token.service';

const INVALID_CREDENTIALS = 'Email or password is incorrect.';
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly mfa: MfaService,
    private readonly throttle: LoginThrottleService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly social: SocialIdentityService,
    config: ConfigService<Env, true>,
  ) {
    this.webAppUrl = config.get('WEB_APP_URL', { infer: true });
  }

  // ───────────── Sign-up and sign-in ─────────────

  async register(input: RegisterRequest, meta: RequestMeta): Promise<AuthTokens> {
    await this.passwords.assertNotBreached(input.password);

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      // Tell the real owner by email instead of confirming the account exists in the response.
      await this.mail.trySend({
        to: input.email,
        subject: 'Someone tried to create a NIXZORA account with your email',
        text: `If this was you, sign in or reset your password at ${this.webAppUrl}/account/forgot-password.`,
        template: 'auth.duplicate-sign-up',
        data: {},
      });
      await this.audit.record({ action: 'auth.register.duplicate', actorId: existing.id, meta });
      throw new ConflictException(
        'We could not create an account with these details. If you already have one, sign in instead.',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await this.passwords.hash(input.password),
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        roles: { create: [{ role: { connect: { key: 'customer' } } }] },
      },
    });

    await this.audit.record({
      action: 'auth.register',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      meta,
    });
    await this.sendEmailVerification(user.id, user.email);

    const issued = await this.sessions.create({
      userId: user.id,
      meta,
      deviceName: input.deviceName,
      mfaVerified: false,
    });
    return this.issueTokens(issued.session, issued.refreshToken);
  }

  async login(input: LoginRequest, meta: RequestMeta): Promise<LoginResponse> {
    if (await this.throttle.isLocked(input.email)) {
      await this.audit.record({
        action: 'auth.login.locked',
        meta,
        metadata: { email: input.email },
      });
      throw new HttpException(
        `Too many failed sign-in attempts. Try again in ${this.throttle.lockoutMinutes} minutes or reset your password.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Always run a password hash check so timing does not reveal whether the email exists.
    const valid = await this.passwords.verify(user?.passwordHash, input.password);

    if (!user || !valid || user.status !== 'ACTIVE') {
      const failures = await this.throttle.recordFailure(input.email);
      await this.audit.record({
        action: 'auth.login.failed',
        actorId: user?.id ?? null,
        meta,
        metadata: {
          email: input.email,
          failures,
          reason: !user ? 'unknown_email' : !valid ? 'bad_password' : 'inactive',
        },
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.throttle.reset(input.email);

    if (user.mfaEnabled) {
      await this.audit.record({ action: 'auth.login.mfa_challenge', actorId: user.id, meta });
      return {
        mfaRequired: true,
        mfaToken: await this.tokens.signMfaChallenge({
          sub: user.id,
          deviceName: input.deviceName,
        }),
      };
    }

    const issued = await this.sessions.create({
      userId: user.id,
      meta,
      deviceName: input.deviceName,
      mfaVerified: false,
    });
    await this.audit.record({
      action: 'auth.login.succeeded',
      actorId: user.id,
      entityType: 'session',
      entityId: issued.session.id,
      meta,
    });
    return this.issueTokens(issued.session, issued.refreshToken);
  }

  /**
   * Sign in with Google or Apple. Finds the account linked to that provider account; otherwise
   * links the account with the same (provider-verified) email; otherwise creates one. Accounts
   * with two-step verification still get the code challenge.
   */
  async socialSignIn(input: SocialSignInRequest, meta: RequestMeta): Promise<LoginResponse> {
    const identity = await this.social.verify(input.provider, input.idToken, input.nonce);
    const provider = toProvider(input.provider);

    const linked = await this.prisma.userIdentity.findUnique({
      where: { provider_subject: { provider, subject: identity.subject } },
      include: { user: true },
    });
    let user: User | null = linked?.user ?? null;
    let created = false;

    if (!user) {
      const existing = await this.prisma.user.findUnique({ where: { email: identity.email } });
      if (existing) {
        // Linking to an existing account by email is only safe when the provider has verified
        // the address; otherwise anyone could claim an account by typing its email at Google.
        if (!identity.emailVerified) {
          throw new UnauthorizedException(
            `Your ${label(input.provider)} email is not verified. Sign in with your password instead.`,
          );
        }
        user = existing;
      } else {
        user = await this.prisma.user.create({
          data: {
            email: identity.email,
            emailVerifiedAt: identity.emailVerified ? new Date() : null,
            firstName: input.firstName || null,
            lastName: input.lastName || null,
            roles: { create: [{ role: { connect: { key: 'customer' } } }] },
          },
        });
        created = true;
      }
    }

    if (user.status !== 'ACTIVE') {
      await this.audit.record({
        action: 'auth.login.failed',
        actorId: user.id,
        meta,
        metadata: { provider: input.provider, reason: 'inactive' },
      });
      throw new UnauthorizedException('This account cannot sign in. Contact support.');
    }

    if (linked) {
      await this.prisma.userIdentity.update({
        where: { id: linked.id },
        data: { lastUsedAt: new Date() },
      });
    } else {
      await this.prisma.userIdentity.create({
        data: { userId: user.id, provider, subject: identity.subject, email: identity.email },
      });
      if (identity.emailVerified && !user.emailVerifiedAt) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
      await this.audit.record({
        action: created ? 'auth.register' : 'auth.identity.linked',
        actorId: user.id,
        entityType: 'user',
        entityId: user.id,
        meta,
        metadata: { provider: input.provider },
      });
      if (created && !identity.emailVerified) await this.sendEmailVerification(user.id, user.email);
    }

    if (user.mfaEnabled) {
      await this.audit.record({ action: 'auth.login.mfa_challenge', actorId: user.id, meta });
      return {
        mfaRequired: true,
        mfaToken: await this.tokens.signMfaChallenge({
          sub: user.id,
          deviceName: input.deviceName,
        }),
      };
    }

    const issued = await this.sessions.create({
      userId: user.id,
      meta,
      deviceName: input.deviceName,
      mfaVerified: false,
    });
    await this.audit.record({
      action: 'auth.login.succeeded',
      actorId: user.id,
      entityType: 'session',
      entityId: issued.session.id,
      meta,
      metadata: { provider: input.provider },
    });
    return this.issueTokens(issued.session, issued.refreshToken, 'fed');
  }

  async completeMfaChallenge(
    mfaToken: string,
    code: string,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const challenge = await this.tokens.verifyMfaChallenge(mfaToken);
    if (!challenge) throw new UnauthorizedException('This sign-in attempt expired. Start again.');

    const factor = await this.mfa.verify(challenge.sub, code);
    if (!factor) {
      await this.audit.record({
        action: 'auth.mfa.challenge_failed',
        actorId: challenge.sub,
        meta,
      });
      throw new UnauthorizedException('That code did not match.');
    }

    const issued = await this.sessions.create({
      userId: challenge.sub,
      meta,
      deviceName: challenge.deviceName,
      mfaVerified: true,
    });
    await this.audit.record({
      action: 'auth.login.succeeded',
      actorId: challenge.sub,
      entityType: 'session',
      entityId: issued.session.id,
      meta,
      metadata: { secondFactor: factor },
    });
    return this.issueTokens(issued.session, issued.refreshToken);
  }

  async refresh(refreshToken: string | undefined, meta: RequestMeta): Promise<AuthTokens> {
    if (!refreshToken) throw new UnauthorizedException('Sign in to continue.');
    const issued = await this.sessions.rotate(refreshToken, meta);
    return this.issueTokens(issued.session, issued.refreshToken);
  }

  async logout(user: AuthUser, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(user.sessionId, user.id);
    await this.audit.record({
      action: 'auth.logout',
      actorId: user.id,
      entityType: 'session',
      entityId: user.sessionId,
      meta,
    });
  }

  async me(userId: string, auth: AuthUser): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { identities: { select: { provider: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      firstName: user.firstName,
      lastName: user.lastName,
      mfaEnabled: user.mfaEnabled,
      hasPassword: user.passwordHash !== null,
      linkedProviders: [...new Set(user.identities.map(({ provider }) => fromProvider(provider)))],
      roles: auth.roles,
      permissions: auth.permissions,
    };
  }

  // ───────────── Email verification and passwords ─────────────

  async sendEmailVerification(userId: string, email: string): Promise<void> {
    const token = await this.createVerificationToken(
      userId,
      'EMAIL_VERIFICATION',
      EMAIL_VERIFICATION_TTL_MS,
    );
    const link = `${this.webAppUrl}/account/verify-email?token=${token}`;
    await this.mail.trySend({
      to: email,
      subject: 'Confirm your email for NIXZORA',
      text: `Confirm your email address: ${link}\nThis link expires in 24 hours.`,
      template: 'auth.verify-email',
      data: { link, token },
    });
  }

  async resendEmailVerification(user: AuthUser): Promise<void> {
    const record = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (record.emailVerifiedAt) return;
    await this.sendEmailVerification(record.id, record.email);
  }

  async verifyEmail(token: string, meta: RequestMeta): Promise<void> {
    const record = await this.consumeVerificationToken(token, 'EMAIL_VERIFICATION');
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    await this.audit.record({
      action: 'auth.email.verified',
      actorId: record.userId,
      entityType: 'user',
      entityId: record.userId,
      meta,
    });
  }

  /** Always succeeds from the caller's point of view, so it cannot be used to discover accounts. */
  async forgotPassword(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;

    const token = await this.createVerificationToken(
      user.id,
      'PASSWORD_RESET',
      PASSWORD_RESET_TTL_MS,
    );
    const link = `${this.webAppUrl}/account/reset-password?token=${token}`;
    await this.mail.trySend({
      to: user.email,
      subject: 'Reset your NIXZORA password',
      text: `Reset your password: ${link}\nThis link expires in 30 minutes. If you did not ask for this, ignore this email.`,
      template: 'auth.reset-password',
      data: { link, token },
    });
    await this.audit.record({ action: 'auth.password.reset_requested', actorId: user.id, meta });
  }

  async resetPassword(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
    await this.passwords.assertNotBreached(newPassword);
    const record = await this.consumeVerificationToken(token, 'PASSWORD_RESET');
    const passwordHash = await this.passwords.hash(newPassword);

    await this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
    const revoked = await this.sessions.revokeAllForUser(record.userId);
    await this.throttle.reset(
      (await this.prisma.user.findUniqueOrThrow({ where: { id: record.userId } })).email,
    );
    await this.audit.record({
      action: 'auth.password.reset_completed',
      actorId: record.userId,
      entityType: 'user',
      entityId: record.userId,
      meta,
      metadata: { sessionsRevoked: revoked },
    });
  }

  async changePassword(
    user: AuthUser,
    input: ChangePasswordRequest,
    meta: RequestMeta,
  ): Promise<void> {
    const record = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await this.passwords.verify(record.passwordHash, input.currentPassword))) {
      throw new BadRequestException('Your current password is incorrect.');
    }
    await this.passwords.assertNotBreached(input.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(input.newPassword) },
    });
    const revoked = await this.sessions.revokeAllForUser(user.id, user.sessionId);
    await this.audit.record({
      action: 'auth.password.changed',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      meta,
      metadata: { otherSessionsRevoked: revoked },
    });
  }

  /**
   * Self-service account deletion (required by the App Store and Google Play for apps that let
   * people sign up). Personal data is erased or anonymised; orders stay for tax and refund records
   * but no longer point to a person who can sign in. Staff accounts are closed by an admin.
   */
  async deleteAccount(
    user: AuthUser,
    confirmation: { password?: string; confirm?: 'DELETE' },
    meta: RequestMeta,
  ): Promise<void> {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { roles: { select: { role: { select: { key: true } } } } },
    });
    if (record.passwordHash) {
      // Accounts with a password must enter it; typing DELETE is not enough.
      if (!(await this.passwords.verify(record.passwordHash, confirmation.password ?? ''))) {
        throw new BadRequestException('Your password is incorrect.');
      }
    } else if (confirmation.confirm !== 'DELETE') {
      throw new BadRequestException('Type DELETE to confirm.');
    }
    if (record.roles.some(({ role }) => role.key !== 'customer')) {
      throw new ConflictException('Staff accounts are closed by an administrator.');
    }

    await this.prisma.$transaction([
      this.prisma.address.deleteMany({ where: { userId: user.id } }),
      this.prisma.wishlistItem.deleteMany({ where: { userId: user.id } }),
      this.prisma.pushDevice.deleteMany({ where: { userId: user.id } }),
      this.prisma.verificationToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
      this.prisma.userIdentity.deleteMany({ where: { userId: user.id } }),
      this.prisma.productEvent.deleteMany({ where: { userId: user.id } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'DELETED',
          email: `deleted-${user.id}@deleted.invalid`,
          emailVerifiedAt: null,
          passwordHash: null,
          firstName: null,
          lastName: null,
          phone: null,
          mfaEnabled: false,
          mfaSecretEnc: null,
          marketingEmails: false,
          reviewRequests: false,
        },
      }),
    ]);
    const revoked = await this.sessions.revokeAllForUser(user.id);
    await this.audit.record({
      action: 'auth.account.deleted',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      meta,
      metadata: { sessionsRevoked: revoked },
    });
  }

  // ───────────── Helpers ─────────────

  /** `method` is the first factor: "pwd" (password) or "fed" (Google / Apple). */
  private async issueTokens(
    session: Session,
    refreshToken: string,
    method: 'pwd' | 'fed' = 'pwd',
  ): Promise<AuthTokens> {
    const amr = session.mfaVerifiedAt ? [method, 'otp'] : [method];
    return {
      accessToken: await this.tokens.signAccessToken({ sub: session.userId, sid: session.id, amr }),
      accessTokenExpiresIn: this.tokens.accessTtlSeconds,
      refreshToken,
      refreshTokenExpiresAt: session.expiresAt.toISOString(),
      sessionId: session.id,
    };
  }

  private async createVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
    ttlMs: number,
  ): Promise<string> {
    const token = randomToken();
    await this.prisma.$transaction([
      // Only the newest link of each kind works.
      this.prisma.verificationToken.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.verificationToken.create({
        data: {
          userId,
          purpose,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + ttlMs),
        },
      }),
    ]);
    return token;
  }

  private async consumeVerificationToken(token: string, purpose: VerificationPurpose) {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    const invalid = new BadRequestException(
      'This link is invalid or has expired. Request a new one.',
    );
    if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt <= new Date()) {
      throw invalid;
    }
    const { count } = await this.prisma.verificationToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count !== 1) throw invalid;
    return record;
  }
}

function toProvider(provider: SocialProvider): IdentityProvider {
  return provider === 'google' ? 'GOOGLE' : 'APPLE';
}

function fromProvider(provider: IdentityProvider): SocialProvider {
  return provider === 'GOOGLE' ? 'google' : 'apple';
}
