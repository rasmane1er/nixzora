import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { translator } from '@nixzora/i18n';
import {
  type DeviceSignInCredential,
  type DeviceSignInEnableRequest,
  type DeviceSignInRequest,
  type DeviceSignInResponse,
  type DeviceSignInSummary,
} from '@nixzora/validation';
import { type Env } from '../../../config/env';
import { randomToken, safeEqual, sha256 } from '../../../common/crypto';
import { toLocale } from '../../../common/locale';
import { type RequestMeta } from '../../../common/request-meta';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { MailService } from '../../notifications/mail.service';
import { type AuthUser } from '../auth-user';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

const MAX_DEVICES = 10;
const NO_LONGER_SET_UP =
  'Face ID / fingerprint sign-in is no longer set up on this device. Sign in with your password.';

/**
 * "Sign in with Face ID / fingerprint" in the app (ADR-0019). Turning it on gives the phone a
 * random secret, which the app keeps in the iOS Keychain / Android Keystore behind the biometric
 * check. Signing in sends the secret; the server answers with a session and a new secret, so a
 * copied secret stops working the next time the real phone signs in. Only hashes are stored.
 */
@Injectable()
export class DeviceSignInService {
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.webAppUrl = config.get('WEB_APP_URL', { infer: true });
  }

  async enable(
    user: AuthUser,
    input: DeviceSignInEnableRequest,
    meta: RequestMeta,
  ): Promise<DeviceSignInCredential> {
    const active = await this.prisma.deviceSignIn.count({
      where: { userId: user.id, revokedAt: null },
    });
    if (active >= MAX_DEVICES) {
      throw new BadRequestException(
        'Face ID / fingerprint sign-in is on for too many devices. Turn it off on one first.',
      );
    }
    const secret = randomToken(32);
    const device = await this.prisma.deviceSignIn.create({
      data: {
        userId: user.id,
        secretHash: sha256(secret),
        deviceName: input.deviceName,
        platform: input.platform,
      },
    });
    await this.audit.record({
      action: 'auth.device_sign_in.enabled',
      actorId: user.id,
      entityType: 'device_sign_in',
      entityId: device.id,
      meta,
      metadata: { deviceName: device.deviceName, platform: device.platform },
    });
    await this.notifyAdded(user.id, device.deviceName);
    return { id: device.id, secret };
  }

  async signIn(input: DeviceSignInRequest, meta: RequestMeta): Promise<DeviceSignInResponse> {
    const device = await this.prisma.deviceSignIn.findUnique({
      where: { id: input.id },
      include: { user: { select: { status: true } } },
    });
    if (
      !device ||
      device.revokedAt ||
      device.user.status !== 'ACTIVE' ||
      !safeEqual(device.secretHash, sha256(input.secret))
    ) {
      await this.audit.record({
        action: 'auth.device_sign_in.failed',
        actorId: device?.userId ?? null,
        entityType: 'device_sign_in',
        entityId: input.id,
        meta,
        metadata: {
          reason: !device ? 'unknown' : device.revokedAt ? 'revoked' : 'secret_or_status',
        },
      });
      throw new UnauthorizedException(NO_LONGER_SET_UP);
    }

    // Rotate first: if two requests race with the same secret, only one wins.
    const nextSecret = randomToken(32);
    const { count } = await this.prisma.deviceSignIn.updateMany({
      where: { id: device.id, secretHash: device.secretHash, revokedAt: null },
      data: { secretHash: sha256(nextSecret), lastUsedAt: new Date() },
    });
    if (!count) throw new UnauthorizedException(NO_LONGER_SET_UP);

    const issued = await this.sessions.create({
      userId: device.userId,
      meta,
      deviceName: input.deviceName ?? device.deviceName,
      // Possession of this phone plus its biometric check: two factors.
      mfaVerified: true,
    });
    await this.audit.record({
      action: 'auth.login.succeeded',
      actorId: device.userId,
      entityType: 'session',
      entityId: issued.session.id,
      meta,
      metadata: { method: 'device', deviceSignInId: device.id },
    });
    const tokens = await this.tokens.authTokens(issued.session, issued.refreshToken, [
      'swk',
      'user',
    ]);
    return { ...tokens, deviceSecret: nextSecret };
  }

  async list(userId: string): Promise<DeviceSignInSummary[]> {
    const devices = await this.prisma.deviceSignIn.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return devices.map((device) => ({
      id: device.id,
      deviceName: device.deviceName,
      platform: device.platform,
      createdAt: device.createdAt.toISOString(),
      lastUsedAt: device.lastUsedAt?.toISOString() ?? null,
    }));
  }

  async revoke(user: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    const { count } = await this.prisma.deviceSignIn.updateMany({
      where: { id, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!count) throw new NotFoundException('Device not found.');
    await this.audit.record({
      action: 'auth.device_sign_in.revoked',
      actorId: user.id,
      entityType: 'device_sign_in',
      entityId: id,
      meta,
    });
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
      text: t('auth_signin_added_text', { method: t('auth_method_device'), name, link }),
      template: 'auth.sign-in-method-added',
      data: { method: 'device', name, link },
    });
  }
}
