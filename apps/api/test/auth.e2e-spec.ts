import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.LOGIN_MAX_FAILURES = '3';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  MeResponseSchema,
  MfaRequiredSchema,
  type AuthTokens,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MailService } from '../src/modules/notifications/mail.service';
import { totp } from '../src/modules/identity/services/totp';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

// Requires PostgreSQL (with migrations applied) and Redis.
describe('Identity (e2e)', () => {
  let app: INestApplication;
  let mail: MailService;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  let counter = 0;
  const password = 'correct horse battery staple';

  const http = () => request(app.getHttpServer());
  const newEmail = () => `user-${run}-${++counter}@example.com`;
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function register(email = newEmail()): Promise<{ email: string; tokens: AuthTokens }> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'Ana', deviceName: 'Test laptop' })
      .expect(201);
    return { email, tokens: AuthTokensSchema.parse(res.body) };
  }

  function login(email: string, pass = password) {
    return http().post('/api/v1/auth/login').send({ email, password: pass });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    mail = app.get(MailService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await removeTestData(app.get(PrismaService), run);
    await app.close();
  }, 30_000);

  describe('access control basics', () => {
    it('rejects requests without a token', async () => {
      const res = await http().get('/api/v1/auth/me').expect(401);
      expect(res.body.message).toBe('Sign in to continue.');
    });

    it('keeps the health check public', async () => {
      await http().get('/api/v1/health').expect(200);
    });

    it('returns field-level validation errors', async () => {
      const res = await http()
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);
      expect(res.body.issues.map((issue: { field: string }) => issue.field).sort()).toEqual([
        'email',
        'password',
      ]);
    });
  });

  describe('registration and email verification', () => {
    it('creates a customer account, signs it in and verifies the email', async () => {
      const { email, tokens } = await register(`  Mixed.Case-${run}@Example.com `);
      expect(email.trim().toLowerCase()).toBe(`mixed.case-${run}@example.com`);

      const me = MeResponseSchema.parse(
        (await http().get('/api/v1/auth/me').set(bearer(tokens.accessToken)).expect(200)).body,
      );
      expect(me.email).toBe(`mixed.case-${run}@example.com`);
      expect(me.roles).toEqual(['customer']);
      expect(me.permissions).toContain('orders.create');
      expect(me.emailVerified).toBe(false);

      const message = mail.lastTo(me.email);
      expect(message?.template).toBe('auth.verify-email');
      const token = message!.data.token!;

      await http().post('/api/v1/auth/email/verify').send({ token }).expect(204);
      const after = await http().get('/api/v1/auth/me').set(bearer(tokens.accessToken));
      expect(after.body.emailVerified).toBe(true);

      // Links are single-use.
      await http().post('/api/v1/auth/email/verify').send({ token }).expect(400);
    });

    it('does not create a second account for the same email', async () => {
      const { email } = await register();
      await http()
        .post('/api/v1/auth/register')
        .send({ email, password: 'another long password' })
        .expect(409);
      expect(mail.lastTo(email)?.template).toBe('auth.duplicate-sign-up');
    });

    it('stores passwords as Argon2id hashes only', async () => {
      const { email } = await register();
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(password);
    });
  });

  describe('sign-in, refresh and sign-out', () => {
    it('gives the same answer for a wrong password and an unknown email', async () => {
      const { email } = await register();
      const wrong = await login(email, 'not the password at all');
      const unknown = await login(`nobody-${run}@example.com`);
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('rotates refresh tokens and revokes the session when an old one is replayed', async () => {
      const { email } = await register();
      const first = AuthTokensSchema.parse((await login(email).expect(200)).body);

      const second = AuthTokensSchema.parse(
        (
          await http()
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: first.refreshToken })
            .expect(200)
        ).body,
      );
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(second.sessionId).toBe(first.sessionId);

      // Replaying the rotated token looks like theft: the whole session ends.
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(401);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: second.refreshToken })
        .expect(401);
      await http().get('/api/v1/auth/me').set(bearer(second.accessToken)).expect(401);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'auth.refresh.reuse_detected', entityId: first.sessionId },
      });
      expect(audit).not.toBeNull();
    });

    it('ends the session on sign-out', async () => {
      const { tokens } = await register();
      await http().post('/api/v1/auth/logout').set(bearer(tokens.accessToken)).expect(204);
      await http().get('/api/v1/auth/me').set(bearer(tokens.accessToken)).expect(401);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });

    it('locks an email after repeated failures, even for the right password', async () => {
      const { email } = await register();
      for (let attempt = 0; attempt < 3; attempt++) {
        await login(email, 'wrong password attempt').expect(401);
      }
      const locked = await login(email).expect(429);
      expect(locked.body.message).toMatch(/Too many failed sign-in attempts/);
    });

    it('lists signed-in devices and signs out the others', async () => {
      const { email, tokens } = await register();
      await login(email).expect(200);
      await login(email).expect(200);

      const list = await http()
        .get('/api/v1/me/sessions')
        .set(bearer(tokens.accessToken))
        .expect(200);
      expect(list.body).toHaveLength(3);
      expect(list.body.filter((session: { current: boolean }) => session.current)).toHaveLength(1);

      await http().delete('/api/v1/me/sessions').set(bearer(tokens.accessToken)).expect(204);
      const after = await http().get('/api/v1/me/sessions').set(bearer(tokens.accessToken));
      expect(after.body).toHaveLength(1);
    });
  });

  describe('password reset', () => {
    it('resets the password and signs out every device', async () => {
      const { email, tokens } = await register();

      await http().post('/api/v1/auth/password/forgot').send({ email }).expect(202);
      await http()
        .post('/api/v1/auth/password/forgot')
        .send({ email: `ghost-${run}@example.com` })
        .expect(202);

      const token = mail.lastTo(email)!.data.token!;
      await http()
        .post('/api/v1/auth/password/reset')
        .send({ token, newPassword: 'a brand new long password' })
        .expect(204);

      await http().get('/api/v1/auth/me').set(bearer(tokens.accessToken)).expect(401);
      await login(email).expect(401);
      await login(email, 'a brand new long password').expect(200);
      await http()
        .post('/api/v1/auth/password/reset')
        .send({ token, newPassword: 'yet another long password' })
        .expect(400);
    });
  });

  describe('two-step verification', () => {
    it('enrolls with an authenticator app and requires a code at sign-in', async () => {
      const { email, tokens } = await register();
      const setup = await http()
        .post('/api/v1/me/mfa/setup')
        .set(bearer(tokens.accessToken))
        .expect(201);
      expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/NIXZORA/);
      const secret: string = setup.body.secret;

      await http()
        .post('/api/v1/me/mfa/enable')
        .set(bearer(tokens.accessToken))
        .send({ code: '000000' === totp(secret) ? '111111' : '000000' })
        .expect(400);

      const enabled = await http()
        .post('/api/v1/me/mfa/enable')
        .set(bearer(tokens.accessToken))
        .send({ code: totp(secret) })
        .expect(201);
      const recoveryCodes: string[] = enabled.body.recoveryCodes;
      expect(recoveryCodes).toHaveLength(10);

      const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(stored.mfaSecretEnc).not.toContain(secret);

      // Password alone is no longer enough.
      const challenge = MfaRequiredSchema.parse((await login(email).expect(200)).body);
      await http()
        .post('/api/v1/auth/mfa/challenge')
        .send({
          mfaToken: challenge.mfaToken,
          code: '123456' === totp(secret, Date.now() + 30_000) ? '654321' : '123456',
        })
        .expect(401);

      // The code used to enroll cannot be replayed; the next time step's code works.
      const signedIn = AuthTokensSchema.parse(
        (
          await http()
            .post('/api/v1/auth/mfa/challenge')
            .send({ mfaToken: challenge.mfaToken, code: totp(secret, Date.now() + 30_000) })
            .expect(200)
        ).body,
      );
      const sessions = await http().get('/api/v1/me/sessions').set(bearer(signedIn.accessToken));
      expect(
        sessions.body.find((session: { id: string }) => session.id === signedIn.sessionId)
          .mfaVerified,
      ).toBe(true);

      // A recovery code works exactly once.
      const second = MfaRequiredSchema.parse((await login(email).expect(200)).body);
      await http()
        .post('/api/v1/auth/mfa/challenge')
        .send({ mfaToken: second.mfaToken, code: recoveryCodes[0] })
        .expect(200);
      const third = MfaRequiredSchema.parse((await login(email).expect(200)).body);
      await http()
        .post('/api/v1/auth/mfa/challenge')
        .send({ mfaToken: third.mfaToken, code: recoveryCodes[0] })
        .expect(401);
    });
  });

  describe('role-based access', () => {
    it('blocks customers from staff routes and requires MFA for staff', async () => {
      const { email, tokens } = await register();
      await http().get('/api/v1/admin/audit-logs').set(bearer(tokens.accessToken)).expect(403);

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      await prisma.userRole.create({
        data: { user: { connect: { id: user.id } }, role: { connect: { key: 'admin' } } },
      });

      const noMfa = await http()
        .get('/api/v1/admin/audit-logs')
        .set(bearer(tokens.accessToken))
        .expect(403);
      expect(noMfa.body.code).toBe('MFA_REQUIRED');

      const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(tokens.accessToken));
      await http()
        .post('/api/v1/me/mfa/enable')
        .set(bearer(tokens.accessToken))
        .send({ code: totp(setup.body.secret) })
        .expect(201);

      const page = await http()
        .get('/api/v1/admin/audit-logs')
        .query({ actorId: user.id, limit: 5 })
        .set(bearer(tokens.accessToken))
        .expect(200);
      const actions = page.body.items.map((item: { action: string }) => item.action);
      expect(actions).toEqual(expect.arrayContaining(['auth.mfa.enabled', 'auth.register']));
    });
  });
});
