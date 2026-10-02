import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.PAYMENTS_PROVIDER = 'fake';
process.env.MAIL_DRIVER = 'log';
process.env.PUSH_DRIVER = 'log';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthTokensSchema, type CheckoutResponse, isValidGtin } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PushService } from '../src/modules/devices/push.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Grace Hopper',
  line1: '1 Navy Way',
  city: 'Annapolis',
  region: 'MD',
  postalCode: '21402',
  country: 'US',
};

describe('Mobile app support: barcode lookup and push devices (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outbox: OutboxService;
  let push: PushService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const barcode = '0036000291452'; // UPC-A 036000291452 in its 13-digit form
  const sku = `CAM-${run}`.toUpperCase();
  let slug: string;
  let variantId: string;
  let token: string;
  let otherToken: string;
  const device = `ExponentPushToken[test-${run}-device]`;
  /** Deleted accounts lose their tagged email, so cleanup tracks them by id. */
  const deletedUserIds: string[] = [];

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
    outbox = app.get(OutboxService);
    push = app.get(PushService);

    const category = await prisma.category.create({
      data: { name: `Mobile ${run}`, slug: `mobile-${run}`, isActive: false },
    });
    const product = await prisma.product.create({
      data: {
        title: `Test Webcam ${run}`,
        slug: `test-webcam-${run}`,
        description: 'A webcam used by the mobile tests.',
        status: 'ACTIVE',
        categoryId: category.id,
        variants: {
          create: [
            {
              sku,
              barcode: barcode.slice(1),
              title: 'Standard',
              priceCents: 4000,
              inventory: { create: { onHand: 10 } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    slug = product.slug;
    variantId = product.variants[0]!.id;
    token = await signUp(`phone-${run}@example.com`);
    otherToken = await signUp(`tablet-${run}@example.com`);
  });

  afterAll(async () => {
    await removeTestData(prisma, run);
    await prisma.user.deleteMany({ where: { id: { in: deletedUserIds } } });
    await app.close();
  }, 30_000);

  describe('GET /catalog/lookup', () => {
    it('finds a product by barcode in either UPC or EAN form', async () => {
      for (const code of [barcode, barcode.slice(1)]) {
        const res = await http().get(`/api/v1/catalog/lookup?code=${code}`).expect(200);
        expect(res.body).toEqual({ slug, variantId });
      }
    });

    it('finds a product by SKU or by a link from a QR code', async () => {
      const bySku = await http().get(`/api/v1/catalog/lookup?code=${sku.toLowerCase()}`);
      expect(bySku.body).toEqual({ slug, variantId });
      const link = encodeURIComponent(`https://shop.example.com/p/${slug}?ref=qr`);
      const byLink = await http().get(`/api/v1/catalog/lookup?code=${link}`).expect(200);
      expect(byLink.body).toEqual({ slug, variantId: null });
    });

    it('answers 404 for unknown codes and 400 for empty ones', async () => {
      await http().get('/api/v1/catalog/lookup?code=4006381333931').expect(404);
      await http().get('/api/v1/catalog/lookup?code=').expect(400);
    });

    it('rejects barcodes with a wrong check digit on admin writes', () => {
      expect(isValidGtin('036000291452')).toBe(true);
      expect(isValidGtin('036000291453')).toBe(false);
    });
  });

  describe('push devices', () => {
    it('needs a signed-in user and a real Expo token', async () => {
      await http().put('/api/v1/me/devices').send({ token: device, platform: 'ios' }).expect(401);
      await http()
        .put('/api/v1/me/devices')
        .set(bearer(token))
        .send({ token: 'not-a-token', platform: 'ios' })
        .expect(400);
    });

    it('registers idempotently and moves a token to whoever signs in on the phone', async () => {
      for (const who of [otherToken, token, token]) {
        await http()
          .put('/api/v1/me/devices')
          .set(bearer(who))
          .send({ token: device, platform: 'ios' })
          .expect(204);
      }
      const rows = await prisma.pushDevice.findMany({ where: { token: device } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.userId).toBe(
        (await prisma.user.findUniqueOrThrow({ where: { email: `phone-${run}@example.com` } })).id,
      );
    });

    it('pushes order updates to the customer’s devices', async () => {
      await http()
        .post('/api/v1/cart/items')
        .set(bearer(token))
        .send({ variantId, quantity: 1 })
        .expect(201);
      const checkout = (
        await http()
          .post('/api/v1/checkout')
          .set(bearer(token))
          .send({ email: `phone-${run}@example.com`, shippingAddress: address })
          .expect(201)
      ).body as CheckoutResponse;
      await http()
        .post('/api/v1/payments/fake/confirm')
        .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
        .expect(200);
      await outbox.drain();

      const sent = push.sentTo(device);
      expect(sent.at(-1)).toMatchObject({
        title: 'Order confirmed',
        data: { path: `/orders/${checkout.orderNumber}`, orderNumber: checkout.orderNumber },
      });
    });

    it('stops pushing once the app signs out', async () => {
      await http()
        .delete('/api/v1/me/devices')
        .set(bearer(otherToken))
        .send({ token: device })
        .expect(204);
      expect(await prisma.pushDevice.count({ where: { token: device } })).toBe(1);
      await http()
        .delete('/api/v1/me/devices')
        .set(bearer(token))
        .send({ token: device })
        .expect(204);
      expect(await prisma.pushDevice.count({ where: { token: device } })).toBe(0);
    });
  });

  describe('account deletion', () => {
    it('needs the password, erases personal data, keeps orders and signs out everywhere', async () => {
      const email = `phone-${run}@example.com`;
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      deletedUserIds.push(user.id);
      await http()
        .put('/api/v1/me/devices')
        .set(bearer(token))
        .send({ token: device, platform: 'android' })
        .expect(204);

      await http().delete('/api/v1/me').set(bearer(token)).send({ password: 'wrong' }).expect(400);
      await http()
        .delete('/api/v1/me')
        .set(bearer(token))
        .send({ password: 'correct horse battery staple' })
        .expect(204);

      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(after).toMatchObject({ status: 'DELETED', passwordHash: null, firstName: null });
      expect(after.email).not.toContain('phone-');
      expect(await prisma.pushDevice.count({ where: { userId: user.id } })).toBe(0);
      expect(await prisma.order.count({ where: { userId: user.id } })).toBe(1);
      await http().get('/api/v1/auth/me').set(bearer(token)).expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ email, password: 'correct horse battery staple' })
        .expect(401);
    });
  });
});
