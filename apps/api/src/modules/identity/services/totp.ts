import { createHmac, randomBytes } from 'node:crypto';

/**
 * TOTP (RFC 6238) on top of HOTP (RFC 4226): HMAC-SHA1, 6 digits, 30-second steps.
 * These are the defaults every authenticator app supports.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160-bit secret, base32 encoded for authenticator apps. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

export function timeStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

export function totp(base32Secret: string, nowMs = Date.now()): string {
  return hotp(base32Decode(base32Secret), timeStep(nowMs));
}

/**
 * Returns the matching time step (allowing ±`window` steps of clock drift), or null.
 * Callers store the step to reject replays of the same code.
 */
export function verifyTotp(
  base32Secret: string,
  code: string,
  nowMs = Date.now(),
  window = 1,
): number | null {
  const secret = base32Decode(base32Secret);
  const current = timeStep(nowMs);
  for (let offset = -window; offset <= window; offset++) {
    if (hotp(secret, current + offset) === code) return current + offset;
  }
  return null;
}

export function otpauthUrl(base32Secret: string, account: string, issuer = 'NIXZORA'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
