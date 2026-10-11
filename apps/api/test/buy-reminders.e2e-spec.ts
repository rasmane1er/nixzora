import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PAYMENTS_PROVIDER = 'fake';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  addDays,
  AuthTokensSchema,
  buyReminderAt,
  type BuyReminderView,
  easternToday,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { BuyRemindersService } from '../src/modules/alerts/buy-reminders.service';
import { PushService } from '../src/modules/devices/push.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Remind me to buy (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reminders: BuyRemindersService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  let token: string;
  let productId: string;
  let variantId: string;
  const pushes: { title: string; body: string }[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PushService)
      .useValue({
        sendToUser: async (_: string, message: { title: string; body: string }) => {
          pushes.push(message);
        },
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    reminders = app.get(BuyRemindersService);
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: `remind-${run}@example.com`, password: 'correct horse battery staple' })
      .expect(201);
    token = AuthTokensSchema.parse(res.body).accessToken;
    const cat = await prisma.category.create({ data: { slug: `rmcat-${run}`, name: 'Remind' } });
    const product = await prisma.product.create({
      data: {
        slug: `rm-lamp-${run}`,
        title: `Remind lamp ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId: cat.id,
        variants: {
          create: {
            sku: `RM-LAMP-${run}`.toUpperCase(),
            title: 'Standard',
            priceCents: 8_000,
            inventory: { create: { onHand: 5 } },
          },
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0]!.id;
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const put = (date: string, status: number) =>
    http().put(`/api/v1/me/buy-reminders/${productId}`).set(auth()).send({ date }).expect(status);

  it('takes a day after today, within 90 days', async () => {
    await put(easternToday(), 400);
    await put(addDays(easternToday(), 91), 400);
    await put('next friday', 400);
    const friday = addDays(easternToday(), 3);
    const set = (await put(friday, 200)).body as BuyReminderView;
    expect(set).toMatchObject({ productId, date: friday, priceCents: 8_000 });
    const row = await prisma.buyReminder.findFirstOrThrow({ where: { productId } });
    expect(row.remindAt.toISOString()).toBe(buyReminderAt(friday).toISOString());
  });

  it('keeps one per product, and lists it with the product', async () => {
    await put(addDays(easternToday(), 5), 200);
    const list = (await http().get('/api/v1/me/buy-reminders').set(auth()).expect(200))
      .body as BuyReminderView[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      date: addDays(easternToday(), 5),
      product: { id: productId, priceFromCents: 8_000 },
    });
  });

  it('sends nothing early, then once on the day, saying the price dropped', async () => {
    expect(await reminders.sweep()).toBe(0);
    await prisma.productVariant.update({ where: { id: variantId }, data: { priceCents: 6_500 } });
    await prisma.buyReminder.updateMany({
      where: { productId },
      data: { remindAt: new Date(Date.now() - 60_000) },
    });
    pushes.length = 0;
    await reminders.sweep();
    const mine = pushes.filter((p) => p.body.includes(`Remind lamp ${run}`));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.title).toMatch(/price dropped/);
    expect(mine[0]!.body).toContain('$65.00');
    expect(mine[0]!.body).toContain('$80.00');
    await reminders.sweep();
    expect(pushes.filter((p) => p.body.includes(`Remind lamp ${run}`))).toHaveLength(1);
    expect(await prisma.buyReminder.count({ where: { productId } })).toBe(0);
  });

  it('can be cancelled', async () => {
    await put(addDays(easternToday(), 2), 200);
    await http().delete(`/api/v1/me/buy-reminders/${productId}`).set(auth()).expect(204);
    expect(await prisma.buyReminder.count({ where: { productId } })).toBe(0);
  });
});
