import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.PAYMENTS_PROVIDER = 'fake';
process.env.MAIL_DRIVER = 'log';
process.env.CORS_ORIGINS = 'https://shop.example';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthTokensSchema } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

/**
 * Security regression checks from the pen-test checklist (docs/security/pentest-checklist.md).
 * Each test names the checklist item it covers; a failure here is a vulnerability.
 */
describe('Security regressions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const password = 'correct horse battery staple';
  let alice: { email: string; token: string };
  let bob: { email: string; token: string };

  async function signUp(name: string, extra: object = {}) {
    const email = `sec-${name}-${run}@example.com`;
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password, ...extra })
      .expect(201);
    return { email, token: AuthTokensSchema.parse(res.body).accessToken };
  }

  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const decode = (part: string) =>
    JSON.parse(Buffer.from(part, 'base64url').toString()) as Record<string, unknown>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    alice = await signUp('alice');
    bob = await signUp('bob');
  });

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  }, 30_000);

  describe('V3 sessions and tokens', () => {
    it('rejects a token whose payload was changed (signature no longer matches)', async () => {
      const [header, payload, signature] = alice.token.split('.') as [string, string, string];
      const bobId = decode(bob.token.split('.')[1]!).sub;
      const forged = `${header}.${b64({ ...decode(payload), sub: bobId })}.${signature}`;
      await http().get('/api/v1/me/sessions').set(bearer(forged)).expect(401);
    });

    it('rejects an unsigned token ("alg": "none")', async () => {
      const payload = alice.token.split('.')[1]!;
      const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${payload}.`;
      await http().get('/api/v1/me/sessions').set(bearer(unsigned)).expect(401);
    });

    it('rejects a token after sign-out', async () => {
      const carol = await signUp('carol');
      await http().get('/api/v1/me/sessions').set(bearer(carol.token)).expect(200);
      await http().post('/api/v1/auth/logout').set(bearer(carol.token)).expect(204);
      await http().get('/api/v1/me/sessions').set(bearer(carol.token)).expect(401);
    });
  });

  describe('V4 access control', () => {
    it('one customer cannot see or change another customer’s address (IDOR)', async () => {
      const created = await http()
        .post('/api/v1/me/addresses')
        .set(bearer(alice.token))
        .send({
          fullName: 'Alice Example',
          line1: '1 Main St',
          city: 'Brandywine',
          region: 'MD',
          postalCode: '20613',
          country: 'US',
        })
        .expect(201);
      const id = created.body.id as string;
      await http()
        .patch(`/api/v1/me/addresses/${id}`)
        .set(bearer(bob.token))
        .send({ city: 'Elsewhere' })
        .expect(404);
      const bobs = await http().get('/api/v1/me/addresses').set(bearer(bob.token)).expect(200);
      expect(JSON.stringify(bobs.body)).not.toContain(id);
    });

    it('a customer cannot reach staff routes', async () => {
      await http().get('/api/v1/admin/users').set(bearer(alice.token)).expect(403);
      await http().get('/api/v1/admin/risk').set(bearer(alice.token)).expect(403);
      await http().get('/api/v1/admin/orders').expect(401);
    });

    it('staff routes need two-step verification, even for an admin', async () => {
      const dave = await signUp('dave');
      await prisma.userRole.create({
        data: { user: { connect: { email: dave.email } }, role: { connect: { key: 'admin' } } },
      });
      const res = await http().get('/api/v1/admin/users').set(bearer(dave.token)).expect(403);
      expect(res.body.code).toBe('MFA_REQUIRED');
    });

    it('sign-up cannot grant roles or verify itself (mass assignment)', async () => {
      const eve = await signUp('eve', {
        roles: ['admin'],
        status: 'ACTIVE',
        emailVerifiedAt: new Date().toISOString(),
        mfaEnabled: true,
      });
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: eve.email },
        include: { roles: { include: { role: true } } },
      });
      expect(user.roles.map((r) => r.role.key)).toEqual(['customer']);
      expect(user.emailVerifiedAt).toBeNull();
      expect(user.mfaEnabled).toBe(false);
    });
  });

  describe('V2 authentication', () => {
    it('password reset gives the same answer for unknown and known emails (no enumeration)', async () => {
      const known = await http().post('/api/v1/auth/password/forgot').send({ email: alice.email });
      const unknown = await http()
        .post('/api/v1/auth/password/forgot')
        .send({ email: `nobody-${run}@example.com` });
      expect(unknown.status).toBe(known.status);
      expect(unknown.body).toEqual(known.body);
    });
  });

  describe('V5 input handling', () => {
    it('treats SQL in a search as text', async () => {
      const res = await http()
        .get('/api/v1/catalog/products')
        .query({ q: "' OR 1=1; DROP TABLE users; --" })
        .expect(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(await prisma.user.count()).toBeGreaterThan(0);
    });

    it('refuses request bodies over the size limit', async () => {
      await http()
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(3 * 1024 * 1024) }))
        .expect(413);
    });

    it('rejects ids that are not UUIDs before they reach the database', async () => {
      await http()
        .patch('/api/v1/me/addresses/1%20OR%201=1')
        .set(bearer(alice.token))
        .send({})
        .expect(400);
    });
  });

  describe('Business logic', () => {
    it('a single-use coupon used in two checkouts at the same moment is redeemed once', async () => {
      const category = await prisma.category.create({
        data: { name: `Sec ${run}`, slug: `sec-${run}`, isActive: false },
      });
      const product = await prisma.product.create({
        data: {
          title: `Race ${run}`,
          slug: `race-${run}`,
          description: 'Coupon race test.',
          status: 'ACTIVE',
          categoryId: category.id,
          variants: {
            create: [
              {
                sku: `RACE-${run}`.toUpperCase(),
                title: 'Standard',
                priceCents: 5000,
                inventory: { create: { onHand: 10 } },
              },
            ],
          },
        },
        include: { variants: true },
      });
      const code = `ONCE${run}`.toUpperCase().slice(0, 30);
      await prisma.coupon.create({
        data: { code, type: 'FIXED', value: 500, maxRedemptions: 1 },
      });
      const carts = await Promise.all(
        [1, 2].map(async () => {
          const added = await http()
            .post('/api/v1/cart/items')
            .send({ variantId: product.variants[0]!.id })
            .expect(201);
          await http()
            .post('/api/v1/cart/coupon')
            .set('X-Cart-Id', added.body.cartId)
            .send({ code })
            .expect(201);
          return added.body.cartId as string;
        }),
      );
      const results = await Promise.all(
        carts.map((cartId, i) =>
          http()
            .post('/api/v1/checkout')
            .send({
              cartId,
              email: `sec-race${i}-${run}@example.com`,
              shippingAddress: {
                fullName: 'Race Tester',
                line1: '1 Main St',
                city: 'Brandywine',
                region: 'MD',
                postalCode: '20613',
                country: 'US',
              },
            }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code } });
      expect(coupon.redemptionCount).toBe(1);
      await prisma.coupon.delete({ where: { code } });
    });
  });

  describe('V7 errors and V14 configuration', () => {
    it('errors carry no stack trace or internals', async () => {
      const res = await http().get('/api/v1/does-not-exist').expect(404);
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/stack|at .*\.js|node_modules|prisma/i);
    });

    it('lets only the configured web origins call the API from a browser (CORS)', async () => {
      const evil = await http().get('/api/v1/health').set('Origin', 'https://evil.example');
      expect(evil.headers['access-control-allow-origin']).toBeUndefined();
      const ours = await http().get('/api/v1/health').set('Origin', 'https://shop.example');
      expect(ours.headers['access-control-allow-origin']).toBe('https://shop.example');
    });

    it('sends the security headers and hides the framework', async () => {
      const res = await http().get('/api/v1/health');
      expect(res.headers['strict-transport-security']).toContain('max-age=');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('refuses Stripe webhooks when Stripe is not the payment provider', async () => {
      await http()
        .post('/api/v1/payments/webhooks/stripe')
        .set('stripe-signature', 't=1,v1=forged')
        .send({ type: 'payment_intent.succeeded' })
        .expect(403);
    });
  });
});
