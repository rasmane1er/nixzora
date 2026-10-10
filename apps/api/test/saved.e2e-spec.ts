import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type Cart,
  type CartAndSaved,
  type SavedItem,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Saved for later (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  let token: string;
  let other: string;
  const variants: Record<'kettle' | 'mug', string> = { kettle: '', mug: '' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const signUp = async (email: string) =>
      AuthTokensSchema.parse(
        (
          await http()
            .post('/api/v1/auth/register')
            .send({ email, password: 'correct horse battery staple' })
            .expect(201)
        ).body,
      ).accessToken;
    token = await signUp(`saved-${run}@example.com`);
    other = await signUp(`saved-other-${run}@example.com`);
    const cat = await prisma.category.create({ data: { slug: `savedcat-${run}`, name: 'Saved' } });
    for (const [key, price] of [
      ['kettle', 6_000],
      ['mug', 1_500],
    ] as const) {
      const product = await prisma.product.create({
        data: {
          slug: `saved-${key}-${run}`,
          title: `Saved test ${key} ${run}`,
          description: 'A test listing.',
          status: 'ACTIVE',
          categoryId: cat.id,
          variants: {
            create: {
              sku: `SAVED-${key}-${run}`.toUpperCase(),
              title: 'Default',
              priceCents: price,
              inventory: { create: { onHand: 10 } },
            },
          },
        },
        include: { variants: true },
      });
      variants[key] = product.variants[0]!.id;
    }
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const add = (variantId: string, quantity: number) =>
    http().post('/api/v1/cart/items').set(bearer(token)).send({ variantId, quantity }).expect(201);

  it('moves a cart line to Saved for later, with its quantity and today’s price', async () => {
    await add(variants.kettle, 2);
    await add(variants.mug, 1);
    const res = (
      await http().post(`/api/v1/cart/items/${variants.kettle}/save`).set(bearer(token)).expect(200)
    ).body as CartAndSaved;
    expect(res.cart.lines.map((l) => l.variantId)).toEqual([variants.mug]);
    expect(res.saved).toEqual([
      expect.objectContaining({
        variantId: variants.kettle,
        quantity: 2,
        priceCents: 6_000,
        savedPriceCents: 6_000,
        problem: null,
      }),
    ]);
  });

  it('shows the price change since it was saved, and sold-out items stay saved', async () => {
    await prisma.productVariant.update({
      where: { id: variants.kettle },
      data: { priceCents: 5_000 },
    });
    let saved = (await http().get('/api/v1/me/saved').set(bearer(token)).expect(200))
      .body as SavedItem[];
    expect(saved[0]).toMatchObject({ priceCents: 5_000, savedPriceCents: 6_000 });

    await prisma.inventoryItem.updateMany({
      where: { variantId: variants.kettle },
      data: { onHand: 0 },
    });
    saved = (await http().get('/api/v1/me/saved').set(bearer(token)).expect(200))
      .body as SavedItem[];
    expect(saved[0]!.problem).toBe('UNAVAILABLE');
    await http().post(`/api/v1/me/saved/${variants.kettle}/cart`).set(bearer(token)).expect(400);
    expect(await prisma.savedItem.count({ where: { variantId: variants.kettle } })).toBe(1);
    await prisma.inventoryItem.updateMany({
      where: { variantId: variants.kettle },
      data: { onHand: 10 },
    });
  });

  it('moves it back to the cart', async () => {
    const res = (
      await http().post(`/api/v1/me/saved/${variants.kettle}/cart`).set(bearer(token)).expect(200)
    ).body as CartAndSaved;
    expect(res.saved).toEqual([]);
    expect(res.cart.lines.find((l) => l.variantId === variants.kettle)).toMatchObject({
      quantity: 2,
      unitPriceCents: 5_000,
    });
  });

  it('is per account, and needs sign-in', async () => {
    await http().post(`/api/v1/cart/items/${variants.mug}/save`).set(bearer(token)).expect(200);
    expect((await http().get('/api/v1/me/saved').set(bearer(other)).expect(200)).body).toEqual([]);
    // Another account can't move or see it.
    await http().post(`/api/v1/me/saved/${variants.mug}/cart`).set(bearer(other)).expect(404);
    await http().get('/api/v1/me/saved').expect(401);
    // Saving something that isn't in your cart.
    await http().post(`/api/v1/cart/items/${variants.mug}/save`).set(bearer(other)).expect(404);
  });

  it('removes a saved item', async () => {
    const left = (
      await http().delete(`/api/v1/me/saved/${variants.mug}`).set(bearer(token)).expect(200)
    ).body as SavedItem[];
    expect(left).toEqual([]);
    const cart = (await http().get('/api/v1/cart').set(bearer(token)).expect(200)).body as Cart;
    expect(cart.lines.map((l) => l.variantId)).toEqual([variants.kettle]);
  });
});
