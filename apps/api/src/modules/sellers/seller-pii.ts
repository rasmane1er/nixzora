import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { decrypt, encrypt } from '../../common/crypto';
import { type Env } from '../../config/env';

/**
 * Encrypts the personal details sellers give for verification (p8-13), so a database dump does
 * not expose them. Uses DATA_ENCRYPTION_KEY, or MFA_ENCRYPTION_KEY until a separate key is set.
 */
@Injectable()
export class SellerPii {
  private readonly logger = new Logger(SellerPii.name);
  private readonly key: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const configured =
      config.get('DATA_ENCRYPTION_KEY', { infer: true }) ??
      config.get('MFA_ENCRYPTION_KEY', { infer: true });
    if (configured) {
      this.key = Buffer.from(configured, 'base64');
    } else {
      if (config.get('NODE_ENV', { infer: true }) === 'production') {
        throw new Error('DATA_ENCRYPTION_KEY or MFA_ENCRYPTION_KEY is required in production.');
      }
      this.logger.warn('No data encryption key: using a temporary one (development only).');
      this.key = randomBytes(32);
    }
  }

  seal(value: string): string {
    return encrypt(value, this.key);
  }

  /** Null when the value was sealed with another key (e.g. a development restart). */
  open(sealed: string): string | null {
    try {
      return decrypt(sealed, this.key);
    } catch {
      return null;
    }
  }
}
