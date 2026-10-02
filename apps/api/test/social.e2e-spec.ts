import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LoginResponseSchema, MeResponseSchema } from '@nixzora/validation';
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { sha256 } from '../src/common/crypto';
import { SocialIdentityService } from '../src/modules/identity/services/social-identity.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const GOOGLE_CLIENT = 'test-web-client.apps.googleusercontent.com';
const APPLE_CLIENT = 'com.nixzora.shop';

describe('Sign in with Google / Apple (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let privateKey: SigningKey;
  let otherKey: SigningKey;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());

  async function idToken(
    claims: Record<string, unknown>,
    options: { issuer?: string; audience?: string; key?: SigningKey; ageSeconds?: number } = {},
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000) - (options.ageSeconds ?? 0);
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(options.issuer ?? 'https://accounts.google.com')
      .setAudience(options.audience ?? GOOGLE_CLIENT)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(options.key ?? privateKey);
  }

  const signIn = (body: Record<string, unknown>) =>
    http()
      .post('/api/v1/auth/social')
      .send({ deviceName: 'e2e', ...body });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const pair = await generateKeyPair('RS256', { extractable: true });
    privateKey = pair.privateKey;
    otherKey = (await generateKeyPair('RS256')).privateKey;
    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256' };
    const keys = createLocalJWKSet({ keys: [jwk] });
    const social = app.get(SocialIdentityService);
    social.useKeysForTesting('google', keys, [GOOGLE_CLIENT]);
    social.useKeysForTesting('apple', keys, [APPLE_CLIENT]);
  }, 30_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  it('creates a verified customer account on the first Google sign-in, and reuses it after', async () => {
    const email = `ada-${run}@example.com`;
    const token = await idToken({ sub: `g-ada-${run}`, email, email_verified: true });

    const first = await signIn({ provider: 'google', idToken: token, firstName: 'Ada' }).expect(
      200,
    );
    const tokens = LoginResponseSchema.parse(first.body);
    expect('accessToken' in tokens).toBe(true);

    const me = await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${(tokens as { accessToken: string }).accessToken}`)
      .expect(200);
    const profile = MeResponseSchema.parse(me.body);
    expect(profile).toMatchObject({
      email,
      emailVerified: true,
      firstName: 'Ada',
      hasPassword: false,
      linkedProviders: ['google'],
      roles: ['customer'],
    });

    await signIn({ provider: 'google', idToken: token }).expect(200);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect(await prisma.userIdentity.count({ where: { user: { email } } })).toBe(1);
  });

  it('links Apple to an existing password account with the same verified email', async () => {
    const email = `grace-${run}@example.com`;
    await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple 42', deviceName: 'e2e' })
      .expect(201);

    const token = await idToken(
      {
        sub: `a-grace-${run}`,
        email,
        email_verified: 'true',
        nonce: sha256(`nonce-${run}-apple-1`),
      },
      { issuer: 'https://appleid.apple.com', audience: APPLE_CLIENT },
    );
    await signIn({ provider: 'apple', idToken: token, nonce: `nonce-${run}-apple-1` }).expect(200);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { identities: true },
    });
    expect(user.identities.map((i) => i.provider)).toEqual(['APPLE']);
    expect(user.passwordHash).not.toBeNull();
  });

  it('refuses to link an existing account when the provider has not verified the email', async () => {
    const email = `grace-${run}@example.com`;
    const token = await idToken({ sub: `g-impostor-${run}`, email, email_verified: false });
    await signIn({ provider: 'google', idToken: token }).expect(401);
    expect(await prisma.userIdentity.count({ where: { subject: `g-impostor-${run}` } })).toBe(0);
  });

  it('rejects forged, foreign, stale and replayed tokens', async () => {
    const claims = { sub: `g-x-${run}`, email: `x-${run}@example.com`, email_verified: true };
    // Signed by someone else's key.
    await signIn({ provider: 'google', idToken: await idToken(claims, { key: otherKey }) }).expect(
      401,
    );
    // Issued to another app.
    await signIn({
      provider: 'google',
      idToken: await idToken(claims, { audience: 'someone-else.apps.googleusercontent.com' }),
    }).expect(401);
    // A Google token presented as Apple.
    await signIn({ provider: 'apple', idToken: await idToken(claims) }).expect(401);
    // Older than an hour.
    await signIn({
      provider: 'google',
      idToken: await idToken(claims, { ageSeconds: 7200 }),
    }).expect(401);
    // Nonce from another sign-in attempt.
    await signIn({
      provider: 'google',
      idToken: await idToken({ ...claims, nonce: `nonce-${run}-original` }),
      nonce: `nonce-${run}-different`,
    }).expect(401);
    expect(await prisma.user.count({ where: { email: `x-${run}@example.com` } })).toBe(0);
  });

  it('lets a Google-only account close itself by typing DELETE', async () => {
    const email = `close-${run}@example.com`;
    const token = await idToken({ sub: `g-close-${run}`, email, email_verified: true });
    const signedIn = await signIn({ provider: 'google', idToken: token }).expect(200);
    const access = (signedIn.body as { accessToken: string }).accessToken;

    await http()
      .delete('/api/v1/me')
      .set('Authorization', `Bearer ${access}`)
      .send({ password: 'anything' })
      .expect(400);
    await http()
      .delete('/api/v1/me')
      .set('Authorization', `Bearer ${access}`)
      .send({ confirm: 'DELETE' })
      .expect(204);
    expect(await prisma.userIdentity.count({ where: { subject: `g-close-${run}` } })).toBe(0);
  });

  it('tells the apps which buttons to show', async () => {
    const res = await http().get('/api/v1/auth/social/providers').expect(200);
    expect(res.body).toHaveProperty('google');
    expect(res.body).toHaveProperty('apple');
  });
});
