import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../../config/env';
import { sha256 } from '../../../common/crypto';
import { RedisService } from '../../../redis/redis.service';

/**
 * Temporary lockout after repeated failed sign-ins for one email address.
 * Complements the per-IP request throttling. Counters live in Redis with a TTL.
 * If Redis is unavailable the check fails open, so sign-in keeps working.
 */
@Injectable()
export class LoginThrottleService {
  private readonly logger = new Logger(LoginThrottleService.name);
  private readonly maxFailures: number;
  private readonly windowSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<Env, true>,
  ) {
    this.maxFailures = config.get('LOGIN_MAX_FAILURES', { infer: true });
    this.windowSeconds = config.get('LOGIN_LOCKOUT_MINUTES', { infer: true }) * 60;
  }

  get lockoutMinutes(): number {
    return this.windowSeconds / 60;
  }

  private key(email: string): string {
    return `auth:login-failures:${sha256(email)}`;
  }

  async isLocked(email: string): Promise<boolean> {
    try {
      const count = Number((await this.redis.client.get(this.key(email))) ?? 0);
      return count >= this.maxFailures;
    } catch (error) {
      this.logger.warn(`Lockout check skipped: ${(error as Error).message}`);
      return false;
    }
  }

  /** Returns the failure count after this attempt. */
  async recordFailure(email: string): Promise<number> {
    try {
      const key = this.key(email);
      const count = await this.redis.client.incr(key);
      if (count === 1) await this.redis.client.expire(key, this.windowSeconds);
      return count;
    } catch (error) {
      this.logger.warn(`Could not record failed sign-in: ${(error as Error).message}`);
      return 0;
    }
  }

  async reset(email: string): Promise<void> {
    try {
      await this.redis.client.del(this.key(email));
    } catch {
      // Expiry clears it anyway.
    }
  }
}
