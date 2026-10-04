import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.WEB_APP_URL = 'http://localhost:3000';
delete process.env.WEBAUTHN_RP_ID;
delete process.env.WEBAUTHN_ORIGINS;

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  DeviceSignInCredentialSchema,
  DeviceSignInResponseSchema,
  MeResponseSchema,
  PasskeyOptionsResponseSchema,
  PasskeySummarySchema,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MailService } from '../src/modules/notifications/mail.service';
import { deviceLabel } from '../src/modules/identity/services/passkey.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';
import { SoftwareAuthenticator } from './software-authenticator';

const ORIGIN = 'http://localhost:3000';

describe('Passkeys and Face ID / fingerprint sign-in (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  const run = Date.now().toString(36);
  const email = `passkey-${run}@example.com`;
  const http = () => request(app.getHttpServer());
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    token = AuthTokensSchema.parse(res.body).accessToken;
  }, 30_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function addPasskey(authenticator: SoftwareAuthenticator, name?: string) {
    const options = PasskeyOptionsResponseSchema.parse(
      (await http().post('/api/v1/me/passkeys/options').set(auth()).expect(200)).body,
    );
    const challenge = options.options.challenge as string;
    return http()
      .post('/api/v1/me/passkeys')
      .set(auth())
      .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Chrome/140.0 Safari/537.36')
      .send({
        challengeToken: options.challengeToken,
        credential: authenticator.register(challenge),
        ...(name ? { name } : {}),
      });
  }

  async function signInOptions() {
    return PasskeyOptionsResponseSchema.parse(
      (await http().post('/api/v1/auth/passkey/options').expect(200)).body,
    );
  }

  it('needs a signed-in account to add a passkey', async () => {
    await http().post('/api/v1/me/passkeys/options').expect(401);
  });

  it('adds a passkey, names it from the browser and emails a security notice', async () => {
    const authenticator = new SoftwareAuthenticator('localhost', ORIGIN);
    const options = PasskeyOptionsResponseSchema.parse(
      (await http().post('/api/v1/me/passkeys/options').set(auth()).expect(200)).body,
    );
    expect(options.options).toMatchObject({
      rp: { id: 'localhost', name: 'NIXZORA' },
      user: { name: email },
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });

    const res = await addPasskey(authenticator);
    expect(res.status).toBe(201);
    const passkey = PasskeySummarySchema.parse(res.body);
    expect(passkey.name).toBe('Chrome on macOS');
    expect(mail.lastTo(email, 'auth.sign-in-method-added')?.text).toContain('A passkey');

    // The same authenticator cannot be added twice (the browser is told to exclude it, too).
    const again = await addPasskey(authenticator);
    expect(again.status).toBe(409);
  });

  it('refuses a passkey made for another website', async () => {
    const options = PasskeyOptionsResponseSchema.parse(
      (await http().post('/api/v1/me/passkeys/options').set(auth()).expect(200)).body,
    );
    const phishing = new SoftwareAuthenticator('localhost', 'https://nixzora-login.example');
    await http()
      .post('/api/v1/me/passkeys')
      .set(auth())
      .send({
        challengeToken: options.challengeToken,
        credential: phishing.register(options.options.challenge as string),
      })
      .expect(400);
  });

  it('signs in with a passkey (counts as two-step), once per challenge', async () => {
    const authenticator = new SoftwareAuthenticator('localhost', ORIGIN);
    expect((await addPasskey(authenticator, 'Test key')).status).toBe(201);

    const options = await signInOptions();
    expect(options.options).toMatchObject({ rpId: 'localhost', userVerification: 'required' });
    const credential = authenticator.authenticate(options.options.challenge as string);
    const res = await http()
      .post('/api/v1/auth/passkey')
      .send({ challengeToken: options.challengeToken, credential, deviceName: 'e2e' })
      .expect(200);
    const tokens = AuthTokensSchema.parse(res.body);
    const me = MeResponseSchema.parse(
      (
        await http()
          .get('/api/v1/auth/me')
          .set({ Authorization: `Bearer ${tokens.accessToken}` })
          .expect(200)
      ).body,
    );
    expect(me.email).toBe(email);
    const session = await prisma.session.findUniqueOrThrow({ where: { id: tokens.sessionId } });
    expect(session.mfaVerifiedAt).not.toBeNull();

    // Replaying the same signed response is refused.
    await http()
      .post('/api/v1/auth/passkey')
      .send({ challengeToken: options.challengeToken, credential })
      .expect(401);

    const stored = await prisma.passkey.findFirstOrThrow({ where: { name: 'Test key' } });
    expect(stored.counter).toBeGreaterThan(0n);
    expect(stored.lastUsedAt).not.toBeNull();
  });

  it('refuses unknown passkeys, other websites and forged challenges', async () => {
    const stranger = new SoftwareAuthenticator('localhost', ORIGIN);
    let options = await signInOptions();
    await http()
      .post('/api/v1/auth/passkey')
      .send({
        challengeToken: options.challengeToken,
        credential: stranger.authenticate(options.options.challenge as string),
      })
      .expect(401);

    const authenticator = new SoftwareAuthenticator('localhost', ORIGIN);
    expect((await addPasskey(authenticator)).status).toBe(201);
    options = await signInOptions();
    await http()
      .post('/api/v1/auth/passkey')
      .send({
        challengeToken: options.challengeToken,
        credential: authenticator.authenticate(
          options.options.challenge as string,
          'https://evil.example',
        ),
      })
      .expect(401);

    options = await signInOptions();
    await http()
      .post('/api/v1/auth/passkey')
      .send({
        challengeToken: options.challengeToken,
        credential: authenticator.authenticate('bm90LXRoZS1jaGFsbGVuZ2U'),
      })
      .expect(401);
    await http()
      .post('/api/v1/auth/passkey')
      .send({
        challengeToken: 'not-a-token',
        credential: authenticator.authenticate(options.options.challenge as string),
      })
      .expect(401);
  });

  it('lists, renames and removes passkeys; a removed passkey no longer signs in', async () => {
    const list = await http().get('/api/v1/me/passkeys').set(auth()).expect(200);
    const passkeys = PasskeySummarySchema.array().parse(list.body);
    expect(passkeys.length).toBeGreaterThanOrEqual(2);

    const authenticator = new SoftwareAuthenticator('localhost', ORIGIN);
    const added = PasskeySummarySchema.parse((await addPasskey(authenticator)).body);
    const renamed = await http()
      .patch(`/api/v1/me/passkeys/${added.id}`)
      .set(auth())
      .send({ name: 'Work laptop' })
      .expect(200);
    expect(renamed.body.name).toBe('Work laptop');

    await http().delete(`/api/v1/me/passkeys/${added.id}`).set(auth()).expect(204);
    await http().delete(`/api/v1/me/passkeys/${added.id}`).set(auth()).expect(404);
    const options = await signInOptions();
    await http()
      .post('/api/v1/auth/passkey')
      .send({
        challengeToken: options.challengeToken,
        credential: authenticator.authenticate(options.options.challenge as string),
      })
      .expect(401);
  });

  it('turns on Face ID / fingerprint sign-in for a phone and rotates its secret', async () => {
    const enabled = DeviceSignInCredentialSchema.parse(
      (
        await http()
          .post('/api/v1/me/device-sign-ins')
          .set(auth())
          .send({ deviceName: 'Pixel 9', platform: 'android' })
          .expect(201)
      ).body,
    );
    expect(mail.lastTo(email, 'auth.sign-in-method-added')?.text).toContain('Pixel 9');

    const first = DeviceSignInResponseSchema.parse(
      (
        await http()
          .post('/api/v1/auth/device')
          .send({ id: enabled.id, secret: enabled.secret })
          .expect(200)
      ).body,
    );
    expect(first.deviceSecret).not.toBe(enabled.secret);
    const session = await prisma.session.findUniqueOrThrow({ where: { id: first.sessionId } });
    expect(session.deviceName).toBe('Pixel 9');

    // A copied (old) secret stops working once the phone has signed in.
    await http()
      .post('/api/v1/auth/device')
      .send({ id: enabled.id, secret: enabled.secret })
      .expect(401);
    const second = DeviceSignInResponseSchema.parse(
      (
        await http()
          .post('/api/v1/auth/device')
          .send({ id: enabled.id, secret: first.deviceSecret })
          .expect(200)
      ).body,
    );

    const devices = await http().get('/api/v1/me/device-sign-ins').set(auth()).expect(200);
    expect(devices.body).toEqual([
      expect.objectContaining({ id: enabled.id, deviceName: 'Pixel 9', platform: 'android' }),
    ]);

    await http().delete(`/api/v1/me/device-sign-ins/${enabled.id}`).set(auth()).expect(204);
    await http()
      .post('/api/v1/auth/device')
      .send({ id: enabled.id, secret: second.deviceSecret })
      .expect(401);
    const after = await http().get('/api/v1/me/device-sign-ins').set(auth()).expect(200);
    expect(after.body).toEqual([]);
  });

  it('names passkeys from the browser', () => {
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Safari/604.1')).toBe(
      'Safari on iPhone',
    );
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36 Edg/140.0')).toBe(
      'Edge on Windows',
    );
    expect(deviceLabel(null)).toBe('Passkey');
  });
});
