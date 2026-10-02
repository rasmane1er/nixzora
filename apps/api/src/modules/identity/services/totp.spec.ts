import { base32Decode, base32Encode, hotp, otpauthUrl, totp, verifyTotp } from './totp';

// RFC 6238 Appendix B test secret: ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('matches the RFC 4226 HOTP test vectors', () => {
    const secret = Buffer.from('12345678901234567890');
    expect([0, 1, 2, 9].map((counter) => hotp(secret, counter))).toEqual([
      '755224',
      '287082',
      '359152',
      '520489',
    ]);
  });

  it('matches the RFC 6238 SHA-1 test vectors (last 6 digits)', () => {
    expect(totp(RFC_SECRET, 59_000)).toBe('287082');
    expect(totp(RFC_SECRET, 1_111_111_109_000)).toBe('081804');
    expect(totp(RFC_SECRET, 1_234_567_890_000)).toBe('005924');
    expect(totp(RFC_SECRET, 2_000_000_000_000)).toBe('279037');
  });

  it('accepts one step of clock drift and rejects older codes', () => {
    const now = 1_234_567_890_000;
    const previous = totp(RFC_SECRET, now - 30_000);
    expect(verifyTotp(RFC_SECRET, previous, now)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now - 90_000), now)).toBeNull();
  });

  it('round-trips base32', () => {
    const bytes = Buffer.from('any bytes at all');
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('builds an otpauth URL authenticator apps can scan', () => {
    expect(otpauthUrl('JBSWY3DPEHPK3PXP', 'ana@example.com')).toBe(
      'otpauth://totp/NIXZORA%3Aana%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=NIXZORA&algorithm=SHA1&digits=6&period=30',
    );
  });
});
