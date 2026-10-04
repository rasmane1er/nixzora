import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';

/**
 * A passkey authenticator in software for tests: real P-256 keys and signatures, "none"
 * attestation, user verification always on. Mirrors what Touch ID or a security key returns.
 */
export class SoftwareAuthenticator {
  readonly credentialId = randomBytes(16);
  private readonly privateKey: KeyObject;
  private readonly publicJwk: { x: string; y: string };
  private counter = 0;

  constructor(
    private readonly rpId: string,
    private readonly origin: string,
  ) {
    const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.privateKey = pair.privateKey;
    const jwk = pair.publicKey.export({ format: 'jwk' });
    this.publicJwk = { x: jwk.x!, y: jwk.y! };
  }

  get id(): string {
    return this.credentialId.toString('base64url');
  }

  /** The browser's PublicKeyCredential.toJSON() after navigator.credentials.create. */
  register(challenge: string, origin = this.origin): Record<string, unknown> {
    const clientDataJSON = this.clientData('webauthn.create', challenge, origin);
    const cosePublicKey = cbor(
      new Map<number, unknown>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, Buffer.from(this.publicJwk.x, 'base64url')],
        [-3, Buffer.from(this.publicJwk.y, 'base64url')],
      ]),
    );
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16BE(this.credentialId.length);
    const authData = Buffer.concat([
      this.authDataHeader(0x45), // user present, user verified, attested credential data
      Buffer.alloc(16), // AAGUID
      idLength,
      this.credentialId,
      cosePublicKey,
    ]);
    const attestationObject = cbor(
      new Map<string, unknown>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: clientDataJSON.toString('base64url'),
        attestationObject: attestationObject.toString('base64url'),
        transports: ['internal'],
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  }

  /** The browser's PublicKeyCredential.toJSON() after navigator.credentials.get. */
  authenticate(challenge: string, origin = this.origin): Record<string, unknown> {
    const clientDataJSON = this.clientData('webauthn.get', challenge, origin);
    const authenticatorData = this.authDataHeader(0x05); // user present + user verified
    const signature = sign(
      'sha256',
      Buffer.concat([authenticatorData, createHash('sha256').update(clientDataJSON).digest()]),
      this.privateKey,
    );
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: clientDataJSON.toString('base64url'),
        authenticatorData: authenticatorData.toString('base64url'),
        signature: signature.toString('base64url'),
        userHandle: null,
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  }

  private clientData(type: string, challenge: string, origin: string): Buffer {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  private authDataHeader(flags: number): Buffer {
    this.counter += 1;
    const count = Buffer.alloc(4);
    count.writeUInt32BE(this.counter);
    return Buffer.concat([
      createHash('sha256').update(this.rpId).digest(),
      Buffer.from([flags]),
      count,
    ]);
  }
}

/** Just enough CBOR (RFC 8949) for attestation objects: maps, byte and text strings, integers. */
function cbor(value: unknown): Buffer {
  const head = (major: number, length: number): Buffer => {
    if (length < 24) return Buffer.from([(major << 5) | length]);
    if (length < 256) return Buffer.from([(major << 5) | 24, length]);
    const b = Buffer.alloc(3);
    b[0] = (major << 5) | 25;
    b.writeUInt16BE(length, 1);
    return b;
  };
  if (typeof value === 'number') {
    return value >= 0 ? head(0, value) : head(1, -1 - value);
  }
  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([head(3, bytes.length), bytes]);
  }
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (value instanceof Map) {
    const parts: Buffer[] = [head(5, value.size)];
    for (const [key, item] of value) parts.push(cbor(key), cbor(item));
    return Buffer.concat(parts);
  }
  throw new Error(`cbor: unsupported value ${String(value)}`);
}
