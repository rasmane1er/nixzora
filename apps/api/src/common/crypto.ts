import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/** URL-safe random token with `bytes` of entropy (default 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Tokens are stored only as SHA-256 hashes: a database leak does not leak usable tokens. */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const VERSION = 'v1';

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext>, each base64url. */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

export function decrypt(payload: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = payload.split('.');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Unsupported ciphertext format');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
