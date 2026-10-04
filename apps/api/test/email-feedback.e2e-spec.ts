import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.SES_EVENTS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:nixzora-test-ses-events';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminUserSchema, AuthTokensSchema } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { EmailSuppressionService } from '../src/modules/notifications/email-suppression.service';
import { MailService } from '../src/modules/notifications/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

/** Bounces and complaints from SES stop our emails to that address (p9-02). */
describe('Email feedback (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  }, 30_000);

  const sns = (overrides: object = {}) =>
    JSON.stringify({
      Type: 'Notification',
      MessageId: 'm-1',
      TopicArn: process.env.SES_EVENTS_TOPIC_ARN,
      Message: JSON.stringify({ eventType: 'Complaint' }),
      Timestamp: new Date().toISOString(),
      SignatureVersion: '2',
      Signature: 'Zm9yZ2Vk',
      SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-x.pem',
      ...overrides,
    });

  it('refuses SNS messages from another topic or with an untrusted certificate', async () => {
    const post = (body: string) =>
      http()
        .post('/api/v1/notifications/webhooks/ses')
        .set('Content-Type', 'text/plain; charset=UTF-8')
        .send(body);
    await post(sns({ TopicArn: 'arn:aws:sns:us-east-1:999:someone-else' })).expect(403);
    await post(sns({ SigningCertURL: 'https://evil.example/cert.pem' })).expect(403);
    await post('not json').expect(400);
  });

  it('stops emailing a bounced address until staff resume it', async () => {
    const email = `bounce-${run}@example.com`;
    await signUp(email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    await app.get(EmailSuppressionService).suppress([email], 'BOUNCE', 'smtp; 550 5.1.1');
    const mail = app.get(MailService);
    expect(
      await mail.trySend({ to: email, subject: 'x', text: 'x', template: 'test.x', data: {} }),
    ).toBe(false);

    const adminEmail = `staff-${run}@example.com`;
    const token = await signUp(adminEmail);
    await prisma.userRole.create({
      data: { user: { connect: { email: adminEmail } }, role: { connect: { key: 'admin' } } },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(token)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(token))
      .send({ code: totp(setup.body.secret) })
      .expect(201);

    const detail = AdminUserSchema.parse(
      (await http().get(`/api/v1/admin/users/${user.id}`).set(bearer(token)).expect(200)).body,
    );
    expect(detail.emailSuppressed).toMatchObject({ reason: 'BOUNCE', detail: 'smtp; 550 5.1.1' });

    const resumed = AdminUserSchema.parse(
      (
        await http()
          .post(`/api/v1/admin/users/${user.id}/emails/resume`)
          .set(bearer(token))
          .expect(201)
      ).body,
    );
    expect(resumed.emailSuppressed).toBeNull();
    expect(
      await mail.trySend({ to: email, subject: 'x', text: 'x', template: 'test.x', data: {} }),
    ).toBe(true);
  });
});
