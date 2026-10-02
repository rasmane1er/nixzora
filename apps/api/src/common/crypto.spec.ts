import { randomBytes } from 'node:crypto';
import { decrypt, encrypt, randomToken, safeEqual, sha256 } from './crypto';

describe('crypto helpers', () => {
  const key = randomBytes(32);

  it('round-trips AES-256-GCM encryption with a fresh IV each time', () => {
    const a = encrypt('JBSWY3DPEHPK3PXP', key);
    const b = encrypt('JBSWY3DPEHPK3PXP', key);
    expect(a).not.toBe(b);
    expect(decrypt(a, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('rejects tampered ciphertext', () => {
    const parts = encrypt('secret', key).split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(parts.join('.'), key)).toThrow();
  });

  it('rejects the wrong key', () => {
    expect(() => decrypt(encrypt('secret', key), randomBytes(32))).toThrow();
  });

  it('creates 256-bit URL-safe tokens and stable hashes', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });
});
