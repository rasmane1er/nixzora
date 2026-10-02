import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type SocialProvider, type SocialProvidersResponse } from '@nixzora/validation';
import { createRemoteJWKSet, type JWTPayload, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { sha256 } from '../../../common/crypto';
import { type Env } from '../../../config/env';

/** What a verified Google or Apple ID token tells us about the person. */
export type VerifiedIdentity = {
  provider: SocialProvider;
  /** The provider's stable user id. */
  subject: string;
  email: string;
  /** False when the provider has not confirmed the person controls the address. */
  emailVerified: boolean;
};

type ProviderSettings = {
  issuers: string[];
  audiences: string[];
  keys: JWTVerifyGetKey;
};

const ISSUERS: Record<SocialProvider, string[]> = {
  google: ['https://accounts.google.com', 'accounts.google.com'],
  apple: ['https://appleid.apple.com'],
};
const GOOGLE_KEYS = new URL('https://www.googleapis.com/oauth2/v3/certs');
const APPLE_KEYS = new URL('https://appleid.apple.com/auth/keys');

/**
 * Verifies ID tokens from Google Identity Services and Sign in with Apple (web and native).
 * Only the signature, issuer, audience (our own client ids), expiry and nonce are trusted; no
 * provider secret is needed because we never exchange authorization codes.
 */
@Injectable()
export class SocialIdentityService {
  private readonly settings: Partial<Record<SocialProvider, ProviderSettings>> = {};
  private readonly publicConfig: SocialProvidersResponse;

  constructor(config: ConfigService<Env, true>) {
    const google = [
      config.get('GOOGLE_WEB_CLIENT_ID', { infer: true }),
      config.get('GOOGLE_IOS_CLIENT_ID', { infer: true }),
      config.get('GOOGLE_ANDROID_CLIENT_ID', { infer: true }),
    ].filter((id): id is string => Boolean(id));
    const servicesId = config.get('APPLE_SERVICES_ID', { infer: true });
    const apple = [
      ...(servicesId ? [servicesId] : []),
      ...config.get('APPLE_BUNDLE_IDS', { infer: true }),
    ];

    if (google.length) {
      this.settings.google = {
        issuers: ISSUERS.google,
        audiences: google,
        keys: createRemoteJWKSet(GOOGLE_KEYS, { cooldownDuration: 30_000 }),
      };
    }
    // Native Apple sign-in works with the bundle ids alone; the web button needs a Services ID.
    this.settings.apple = {
      issuers: ISSUERS.apple,
      audiences: apple,
      keys: createRemoteJWKSet(APPLE_KEYS, { cooldownDuration: 30_000 }),
    };

    this.publicConfig = {
      google: google.length
        ? {
            webClientId: config.get('GOOGLE_WEB_CLIENT_ID', { infer: true }) ?? null,
            iosClientId: config.get('GOOGLE_IOS_CLIENT_ID', { infer: true }) ?? null,
            androidClientId: config.get('GOOGLE_ANDROID_CLIENT_ID', { infer: true }) ?? null,
          }
        : null,
      apple: { servicesId: servicesId ?? null },
    };
  }

  /** Which buttons the apps should show, with the public client ids they need. */
  providers(): SocialProvidersResponse {
    return this.publicConfig;
  }

  /** Test seam: verify tokens against a local key set instead of the provider's. */
  useKeysForTesting(provider: SocialProvider, keys: JWTVerifyGetKey, audiences: string[]): void {
    this.settings[provider] = { issuers: ISSUERS[provider], audiences, keys };
  }

  async verify(
    provider: SocialProvider,
    idToken: string,
    nonce?: string,
  ): Promise<VerifiedIdentity> {
    const settings = this.settings[provider];
    if (!settings || !settings.audiences.length) {
      throw new UnauthorizedException(`Sign in with ${label(provider)} is not available.`);
    }

    let payload: JWTPayload & Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(idToken, settings.keys, {
        issuer: settings.issuers,
        audience: settings.audiences,
        clockTolerance: 60,
        maxTokenAge: '1h',
      }));
    } catch {
      throw new UnauthorizedException(
        `We could not confirm your ${label(provider)} sign-in. Try again.`,
      );
    }

    // The nonce ties the token to the sign-in attempt we started, so a stolen token cannot be
    // replayed. Apple's native SDK hashes it (SHA-256 hex); Google and Apple JS echo it as given.
    if (nonce !== undefined) {
      const claim = typeof payload.nonce === 'string' ? payload.nonce : '';
      if (claim !== nonce && claim !== sha256(nonce)) {
        throw new UnauthorizedException('This sign-in attempt expired. Start again.');
      }
    }

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!payload.sub || !email) {
      throw new UnauthorizedException(
        `Your ${label(provider)} account did not share an email address, which we need for receipts.`,
      );
    }
    // Apple sends booleans as strings.
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    return { provider, subject: payload.sub, email, emailVerified };
  }
}

export function label(provider: SocialProvider): string {
  return provider === 'google' ? 'Google' : 'Apple';
}
