import {
  generateKeyPairSync,
  type KeyObject,
  createPrivateKey,
  createPublicKey,
} from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify, SignJWT } from 'jose';
import { type Env } from '../../../config/env';

export type AccessClaims = {
  sub: string;
  sid: string;
  /** Authentication methods used for this session: "pwd", plus "otp" after MFA. */
  amr: string[];
};

export type MfaChallengeClaims = {
  sub: string;
  deviceName?: string;
};

const ALG = 'EdDSA';

/**
 * Signs and verifies NIXZORA JWTs with Ed25519.
 * Access tokens are short-lived; refresh tokens are opaque and live in the sessions table.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly issuer: string;
  private readonly audience: string;
  readonly accessTtlSeconds: number;

  constructor(config: ConfigService<Env, true>) {
    const privatePem = config.get('JWT_PRIVATE_KEY', { infer: true });
    const publicPem = config.get('JWT_PUBLIC_KEY', { infer: true });

    if (privatePem && publicPem) {
      this.privateKey = createPrivateKey(privatePem);
      this.publicKey = createPublicKey(publicPem);
    } else {
      // Development and tests only (production refuses to start without keys, see env.ts).
      this.logger.warn(
        'JWT keys not configured: using a temporary key pair. Tokens reset on restart.',
      );
      const pair = generateKeyPairSync('ed25519');
      this.privateKey = pair.privateKey;
      this.publicKey = pair.publicKey;
    }

    this.issuer = config.get('JWT_ISSUER', { infer: true });
    this.audience = config.get('JWT_AUDIENCE', { infer: true });
    this.accessTtlSeconds = config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
  }

  signAccessToken(claims: AccessClaims): Promise<string> {
    return new SignJWT({ sid: claims.sid, amr: claims.amr })
      .setProtectedHeader({ alg: ALG, typ: 'at+jwt' })
      .setSubject(claims.sub)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtlSeconds}s`)
      .sign(this.privateKey);
  }

  async verifyAccessToken(token: string): Promise<AccessClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
        algorithms: [ALG],
        issuer: this.issuer,
        audience: this.audience,
        typ: 'at+jwt',
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
      return {
        sub: payload.sub,
        sid: payload.sid,
        amr: Array.isArray(payload.amr) ? payload.amr.map(String) : [],
      };
    } catch {
      return null;
    }
  }

  /** Proves the password step passed; exchanged for tokens once the TOTP code is checked. */
  signMfaChallenge(claims: MfaChallengeClaims): Promise<string> {
    return new SignJWT({ deviceName: claims.deviceName })
      .setProtectedHeader({ alg: ALG, typ: 'mfa-challenge+jwt' })
      .setSubject(claims.sub)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(this.privateKey);
  }

  async verifyMfaChallenge(token: string): Promise<MfaChallengeClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
        algorithms: [ALG],
        issuer: this.issuer,
        audience: this.audience,
        typ: 'mfa-challenge+jwt',
      });
      if (typeof payload.sub !== 'string') return null;
      return {
        sub: payload.sub,
        deviceName: typeof payload.deviceName === 'string' ? payload.deviceName : undefined,
      };
    } catch {
      return null;
    }
  }
}
