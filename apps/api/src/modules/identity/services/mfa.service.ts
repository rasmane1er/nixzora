import { randomBytes, randomInt } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type MfaEnabledResponse, type MfaSetupResponse } from '@nixzora/validation';
import { type Env } from '../../../config/env';
import { decrypt, encrypt, sha256 } from '../../../common/crypto';
import { type RequestMeta } from '../../../common/request-meta';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { generateTotpSecret, otpauthUrl, STEP_SECONDS, verifyTotp } from './totp';

// No 0/O or 1/I so codes are easy to read back from paper.
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_COUNT = 10;
const TOTP_PATTERN = /^\d{6}$/;

export type SecondFactor = 'totp' | 'recovery_code';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly key: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    const configured = config.get('MFA_ENCRYPTION_KEY', { infer: true });
    if (configured) {
      this.key = Buffer.from(configured, 'base64');
    } else {
      // Development and tests only; production refuses to start without it (see env.ts).
      this.logger.warn('MFA_ENCRYPTION_KEY not set: using a temporary key. MFA resets on restart.');
      this.key = randomBytes(32);
    }
  }

  /** Step 1: create a secret for the authenticator app. MFA is not active until confirmed. */
  async startSetup(userId: string): Promise<MfaSetupResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) {
      throw new ConflictException(
        'Two-step verification is already on. Turn it off first to reset it.',
      );
    }
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: encrypt(secret, this.key) },
    });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  /** Step 2: confirm with a code from the app. Marks the current session as MFA-verified. */
  async confirmSetup(
    userId: string,
    sessionId: string,
    code: string,
    meta: RequestMeta,
  ): Promise<MfaEnabledResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) throw new ConflictException('Two-step verification is already on.');
    if (!user.mfaSecretEnc) throw new BadRequestException('Start setup first.');
    if (!TOTP_PATTERN.test(code) || !(await this.checkTotp(userId, user.mfaSecretEnc, code))) {
      throw new BadRequestException(
        'That code did not match. Check the time on your phone and try again.',
      );
    }

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } }),
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({ userId, codeHash: sha256(recoveryCode) })),
      }),
      this.prisma.session.update({ where: { id: sessionId }, data: { mfaVerifiedAt: new Date() } }),
    ]);

    await this.audit.record({
      action: 'auth.mfa.enabled',
      actorId: userId,
      entityType: 'user',
      entityId: userId,
      meta,
    });
    return { recoveryCodes };
  }

  async disable(userId: string, code: string, meta: RequestMeta): Promise<void> {
    const factor = await this.verify(userId, code);
    if (!factor) throw new BadRequestException('That code did not match.');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecretEnc: null },
      }),
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.session.updateMany({ where: { userId }, data: { mfaVerifiedAt: null } }),
    ]);
    await this.audit.record({
      action: 'auth.mfa.disabled',
      actorId: userId,
      entityType: 'user',
      entityId: userId,
      meta,
      metadata: { factor },
    });
  }

  /** Checks a TOTP code or consumes a recovery code. Returns which factor passed, or null. */
  async verify(userId: string, code: string): Promise<SecondFactor | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecretEnc) return null;

    if (TOTP_PATTERN.test(code)) {
      return (await this.checkTotp(userId, user.mfaSecretEnc, code)) ? 'totp' : null;
    }

    const { count } = await this.prisma.mfaRecoveryCode.updateMany({
      where: { userId, codeHash: sha256(code.toUpperCase()), usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1 ? 'recovery_code' : null;
  }

  /** TOTP check with replay protection: each time step can be used once per user. */
  private async checkTotp(userId: string, secretEnc: string, code: string): Promise<boolean> {
    const step = verifyTotp(decrypt(secretEnc, this.key), code);
    if (step === null) return false;

    const key = `auth:mfa-last-step:${userId}`;
    try {
      const last = Number((await this.redis.client.get(key)) ?? -1);
      if (step <= last) return false;
      await this.redis.client.set(key, String(step), 'EX', STEP_SECONDS * 4);
    } catch (error) {
      this.logger.warn(`TOTP replay check skipped: ${(error as Error).message}`);
    }
    return true;
  }
}

function generateRecoveryCode(): string {
  const chars = Array.from(
    { length: 12 },
    () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)],
  );
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
}
