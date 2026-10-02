import { generateKeyPairSync } from 'node:crypto';
import { validateEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://nixzora:secret@localhost:5432/nixzora',
  REDIS_URL: 'redis://localhost:6379',
};

describe('validateEnv', () => {
  it('applies defaults and splits CORS origins', () => {
    const env = validateEnv({ ...valid, CORS_ORIGINS: 'http://a.test, http://b.test' });
    expect(env.API_PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.PASSWORD_BREACH_CHECK).toBe(false);
  });

  it('rejects a non-Postgres database URL with a readable message', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a missing Redis URL', () => {
    expect(() => validateEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(/REDIS_URL/);
  });

  it('requires signing and encryption keys in production', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'production' })).toThrow(
      /JWT_PRIVATE_KEY: is required in production[\s\S]*MFA_ENCRYPTION_KEY/,
    );
  });

  it('decodes base64 PEM keys', () => {
    const { privateKey } = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const env = validateEnv({
      ...valid,
      JWT_PRIVATE_KEY: Buffer.from(privateKey).toString('base64'),
    });
    expect(env.JWT_PRIVATE_KEY).toContain('BEGIN PRIVATE KEY');
  });

  it('treats empty values from .env as not set', () => {
    const env = validateEnv({ ...valid, JWT_PRIVATE_KEY: '', MFA_ENCRYPTION_KEY: '' });
    expect(env.JWT_PRIVATE_KEY).toBeUndefined();
    expect(env.MFA_ENCRYPTION_KEY).toBeUndefined();
  });

  it('rejects an MFA key that is not 32 bytes', () => {
    expect(() =>
      validateEnv({ ...valid, MFA_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') }),
    ).toThrow(/MFA_ENCRYPTION_KEY/);
  });

  it('requires real payments, email and order-link secret in production', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'production' })).toThrow(
      /PAYMENTS_PROVIDER: must be "stripe"[\s\S]*ORDER_LINK_SECRET[\s\S]*MAIL_DRIVER/,
    );
  });

  it('needs all three Stripe keys when Stripe is on', () => {
    expect(() => validateEnv({ ...valid, PAYMENTS_PROVIDER: 'stripe' })).toThrow(
      /STRIPE_SECRET_KEY[\s\S]*STRIPE_PUBLISHABLE_KEY[\s\S]*STRIPE_WEBHOOK_SECRET/,
    );
  });

  it('parses tax rates by state', () => {
    expect(validateEnv({ ...valid, TAX_RATES_BPS: 'MD:600, VA:530' }).TAX_RATES_BPS).toEqual({
      MD: 600,
      VA: 530,
    });
    expect(() => validateEnv({ ...valid, TAX_RATES_BPS: 'Maryland=6%' })).toThrow(/TAX_RATES_BPS/);
  });
});
