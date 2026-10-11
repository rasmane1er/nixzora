import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PAYMENTS_PROVIDER = 'fake';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthTokensSchema, type BudgetView, easternMonth } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Monthly budget (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: `budget-${run}@example.com`, password: 'correct horse battery staple' })
      .expect(201);
    token = AuthTokensSchema.parse(res.body).accessToken;
    userId = (
      await prisma.user.findUniqueOrThrow({ where: { email: `budget-${run}@example.com` } })
    ).id;
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const get = async () =>
    (
      await http()
        .get('/api/v1/me/budget')
        .set({ Authorization: `Bearer ${token}` })
        .expect(200)
    ).body as BudgetView;
  const put = (monthlyCents: number | null, status: number) =>
    http()
      .put('/api/v1/me/budget')
      .set({ Authorization: `Bearer ${token}` })
      .send({ monthlyCents })
      .expect(status);

  const order = (n: number, totalCents: number, status: string, placedAt: Date, refunded = 0) =>
    prisma.order.create({
      data: {
        number: `NX-B${n}${run}`.slice(0, 20).toUpperCase(),
        userId,
        email: `budget-${run}@example.com`,
        status: status as 'PAID',
        subtotalCents: totalCents,
        totalCents,
        refundedCents: refunded,
        placedAt,
        shippingAddress: {},
      },
    });

  it('starts with no budget', async () => {
    expect(await get()).toMatchObject({ monthlyCents: null, spentCents: 0, leftCents: 0 });
  });

  it('takes $10 to $100,000, or off', async () => {
    await put(999, 400);
    await put(10_000_001, 400);
    expect((await put(50_000, 200)).body).toMatchObject({
      monthlyCents: 50_000,
      leftCents: 50_000,
    });
  });

  it('counts what was paid this Eastern month, less refunds', async () => {
    const { start } = easternMonth();
    await order(1, 20_000, 'PAID', new Date(start.getTime() + 60_000));
    await order(2, 10_000, 'PARTIALLY_REFUNDED', new Date(), 4_000);
    // Not counted: last month, unpaid and cancelled.
    await order(3, 30_000, 'DELIVERED', new Date(start.getTime() - 60_000));
    await order(4, 30_000, 'PENDING_PAYMENT', new Date());
    await order(5, 30_000, 'CANCELLED', new Date());
    expect(await get()).toMatchObject({
      monthlyCents: 50_000,
      spentCents: 26_000,
      leftCents: 24_000,
      month: easternMonth().month,
    });
  });

  it('goes negative once over, and turns off', async () => {
    await put(20_000, 200);
    expect((await get()).leftCents).toBe(-6_000);
    expect((await put(null, 200)).body).toMatchObject({ monthlyCents: null, leftCents: 0 });
  });
});
