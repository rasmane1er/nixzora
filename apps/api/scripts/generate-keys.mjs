// Prints fresh secrets for apps/api/.env. Run: pnpm --filter @nixzora/api keys:generate
// Never commit the output. Production secrets live in AWS Secrets Manager (Phase 4).
import { generateKeyPairSync, randomBytes } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const b64 = (value) => Buffer.from(value).toString('base64');

console.log(`JWT_PRIVATE_KEY=${b64(privateKey)}`);
console.log(`JWT_PUBLIC_KEY=${b64(publicKey)}`);
console.log(`MFA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
