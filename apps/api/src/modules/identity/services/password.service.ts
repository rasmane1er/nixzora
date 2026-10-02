import { createHash } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from '@node-rs/argon2';
import { type Env } from '../../../config/env';

// OWASP Password Storage Cheat Sheet minimum for Argon2id: m=19 MiB, t=2, p=1.
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  /** Verified against when the email is unknown, so response time does not reveal accounts. */
  private readonly dummyHash: Promise<string>;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.dummyHash = hash('nixzora-timing-equalizer', ARGON2_OPTIONS);
  }

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string | null | undefined, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash ?? (await this.dummyHash), password);
    } catch {
      return false;
    }
  }

  /**
   * Rejects passwords found in known breaches using Have I Been Pwned's k-anonymity API:
   * only the first 5 characters of the SHA-1 hash leave the server.
   * Fails open (with a warning) if the service is unreachable.
   */
  async assertNotBreached(password: string): Promise<void> {
    if (!this.config.get('PASSWORD_BREACH_CHECK', { infer: true })) return;

    const digest = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = digest.slice(0, 5);
    const suffix = digest.slice(5);

    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'nixzora-api' },
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      const breached = body
        .split('\n')
        .some((line) => line.startsWith(`${suffix}:`) && !line.trim().endsWith(':0'));
      if (breached) {
        throw new BadRequestException(
          'This password has appeared in a data breach. Choose a different one.',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Breached-password check skipped: ${(error as Error).message}`);
    }
  }
}
