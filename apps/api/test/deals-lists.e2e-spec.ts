import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PAYMENTS_PROVIDER = 'fake';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type Cart,
  type CheckoutResponse,
  type DealsPage,
  type DealView,
  type SharedListView,
  type ShoppingListView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DealsService } from '../src/modules/deals/deals.service';
import { totp } from '../src/modules/identity/services/totp';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Ada Lovelace',
  line1: '100 Main St',
  city: 'Brandywine',
  region: 'MD',
  postalCode: '20613',
  country: 'US',
};

describe('Deals, lists and Buy now (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let deals: DealsService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const products: Record<string, { id: string; variantId: string }> = {};

  let ownerToken: string;
  let staffToken: string;
  let shopperToken: string;
  let rivalId: string;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function staff(email: string): Promise<string> {
    const token = await signUp(email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.userRole.create({
      data: { user: { connect: { id: user.id } }, role: { connect: { key: 'admin' } } },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(token)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(token))
      .send({ code: totp(setup.body.secret) })
      .expect(201);
    return token;
  }

  async function product(key: string, categoryId: string, seller: string | null, onHand = 50) {
    const created = await prisma.product.create({
      data: {
        slug: `${key}-${run}`,
        title: `Deal test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId: seller,
        variants: {
          create: [
            {
              sku: `${key}-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents: 10_000,
              inventory: { create: { onHand } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    products[key] = { id: created.id, variantId: created.variants[0]!.id };
  }

  const price = async (key: string) =>
    prisma.productVariant.findUniqueOrThrow({ where: { id: products[key]!.variantId } });

  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

  async function pay(checkout: CheckoutResponse) {
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    await app.get(OutboxService).drain();
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    deals = app.get(DealsService);

    ownerToken = await signUp(`deal-owner-${run}@example.com`);
    staffToken = await staff(`deal-staff-${run}@example.com`);
    shopperToken = await signUp(`deal-shopper-${run}@example.com`);
    await prisma.user.update({
      where: { email: `deal-shopper-${run}@example.com` },
      data: { firstName: 'Grace', lastName: 'Hopper' },
    });
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `deal-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `dealshop-${run}`,
        displayName: 'Deal Shop',
        legalName: 'Deal Shop LLC',
        contactEmail: `deal-owner-${run}@example.com`,
        status: 'ACTIVE',
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    const cat = await prisma.category.create({
      data: { slug: `dealcat-${run}`, name: 'Deal tests' },
    });
    await product('mine', cat.id, seller.id);
    await product('flash', cat.id, seller.id);
    await product('house', cat.id, null);
    await product('rival', cat.id, null);
    rivalId = products.rival!.id;
    await app.get(OutboxService).drain();
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  describe('deals', () => {
    let dayDeal: DealView;

    it('lets a store put only its own products on deal', async () => {
      await http()
        .post('/api/v1/seller/deals')
        .set(bearer(ownerToken))
        .send({
          productId: rivalId,
          kind: 'DAY',
          percentOff: 20,
          startsAt: inHours(-0.01),
          endsAt: inHours(24),
        })
        .expect(403);
      // Lightning deals are capped at 12 hours.
      await http()
        .post('/api/v1/seller/deals')
        .set(bearer(ownerToken))
        .send({
          productId: products.mine!.id,
          kind: 'LIGHTNING',
          percentOff: 20,
          startsAt: inHours(-0.01),
          endsAt: inHours(13),
        })
        .expect(400);
    });

    it('takes the price down at once and shows the regular price as "was"', async () => {
      const res = await http()
        .post('/api/v1/seller/deals')
        .set(bearer(ownerToken))
        .send({
          productId: products.mine!.id,
          kind: 'DAY',
          percentOff: 25,
          startsAt: inHours(-0.01),
          endsAt: inHours(48),
        })
        .expect(201);
      dayDeal = res.body as DealView;
      expect(dayDeal.status).toBe('LIVE');
      const variant = await price('mine');
      expect(variant.priceCents).toBe(7_500);
      expect(variant.compareAtCents).toBe(10_000);

      const page = (await http().get('/api/v1/catalog/deals').expect(200)).body as DealsPage;
      const card = page.live.find((p) => p.id === products.mine!.id);
      expect(card?.deal).toMatchObject({ kind: 'DAY', percentOff: 25 });
    });

    it('refuses an overlapping deal and price edits while one is live', async () => {
      await http()
        .post('/api/v1/admin/deals')
        .set(bearer(staffToken))
        .send({
          productId: products.mine!.id,
          kind: 'LIGHTNING',
          percentOff: 40,
          startsAt: inHours(1),
          endsAt: inHours(2),
        })
        .expect(409);
      await http()
        .patch(`/api/v1/admin/variants/${products.mine!.variantId}`)
        .set(bearer(staffToken))
        .send({ priceCents: 9_000 })
        .expect(409);
    });

    it('puts the regular price back when the deal is cancelled', async () => {
      await http()
        .post(`/api/v1/seller/deals/${dayDeal.id}/cancel`)
        .set(bearer(ownerToken))
        .expect(200);
      const variant = await price('mine');
      expect(variant.priceCents).toBe(10_000);
      expect(variant.compareAtCents).toBeNull();
    });

    it('starts scheduled deals and ends them on time', async () => {
      const res = await http()
        .post('/api/v1/admin/deals')
        .set(bearer(staffToken))
        .send({
          productId: products.house!.id,
          kind: 'LIGHTNING',
          percentOff: 30,
          startsAt: inHours(1),
          endsAt: inHours(3),
        })
        .expect(201);
      expect(res.body.status).toBe('SCHEDULED');
      const upcoming = (await http().get('/api/v1/catalog/deals').expect(200)).body as DealsPage;
      expect(upcoming.upcoming.map((u) => u.product.id)).toContain(products.house!.id);

      await deals.tick(new Date(Date.now() + 1.5 * 3_600_000));
      expect((await price('house')).priceCents).toBe(7_000);
      await deals.tick(new Date(Date.now() + 4 * 3_600_000));
      expect((await price('house')).priceCents).toBe(10_000);
      expect((await prisma.deal.findUniqueOrThrow({ where: { id: res.body.id } })).status).toBe(
        'ENDED',
      );
    });

    it('counts paid units and ends a limited deal when it sells out', async () => {
      const res = await http()
        .post('/api/v1/seller/deals')
        .set(bearer(ownerToken))
        .send({
          productId: products.flash!.id,
          kind: 'LIGHTNING',
          percentOff: 50,
          startsAt: inHours(-0.01),
          endsAt: inHours(6),
          quantity: 2,
        })
        .expect(201);
      expect((await price('flash')).priceCents).toBe(5_000);

      const buy = (
        await http()
          .post('/api/v1/cart/buy-now')
          .send({ variantId: products.flash!.variantId, quantity: 2 })
          .expect(201)
      ).body as Cart;
      const checkout = (
        await http()
          .post('/api/v1/checkout')
          .send({
            buyNowId: buy.cartId,
            email: `deal-guest-${run}@example.com`,
            shippingAddress: address,
          })
          .expect(201)
      ).body as CheckoutResponse;
      expect(checkout.totals.subtotalCents).toBe(10_000);
      await pay(checkout);

      const deal = await prisma.deal.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(deal.claimed).toBe(2);
      expect(deal.status).toBe('ENDED');
      expect((await price('flash')).priceCents).toBe(10_000);
    });
  });

  describe('Buy now', () => {
    it('checks out just the one item and leaves the cart alone', async () => {
      await http()
        .post('/api/v1/cart/items')
        .set(bearer(shopperToken))
        .send({ variantId: products.rival!.variantId, quantity: 1 })
        .expect(201);

      const buy = (
        await http()
          .post('/api/v1/cart/buy-now')
          .set(bearer(shopperToken))
          .send({ variantId: products.house!.variantId })
          .expect(201)
      ).body as Cart;
      expect(buy.cartId).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(buy.lines.map((l) => l.variantId)).toEqual([products.house!.variantId]);
      const again = (
        await http().get(`/api/v1/cart/buy-now/${buy.cartId}`).query({ region: 'MD' }).expect(200)
      ).body as Cart;
      expect(again.itemCount).toBe(1);

      const checkout = (
        await http()
          .post('/api/v1/checkout')
          .set(bearer(shopperToken))
          .send({
            buyNowId: buy.cartId,
            email: `deal-shopper-${run}@example.com`,
            shippingAddress: address,
          })
          .expect(201)
      ).body as CheckoutResponse;
      await pay(checkout);

      const cart = (await http().get('/api/v1/cart').set(bearer(shopperToken)).expect(200))
        .body as Cart;
      expect(cart.lines.map((l) => l.variantId)).toEqual([products.rival!.variantId]);
      const emptied = (await http().get(`/api/v1/cart/buy-now/${buy.cartId}`).expect(200))
        .body as Cart;
      expect(emptied.itemCount).toBe(0);
    });

    it('rejects a malformed Buy now id', async () => {
      await http().get('/api/v1/cart/buy-now/nope').expect(400);
    });
  });

  describe('lists and registries', () => {
    let list: ShoppingListView;

    it('keeps lists private to their owner', async () => {
      const created = await http()
        .post('/api/v1/me/lists')
        .set(bearer(shopperToken))
        .send({ name: 'Baby shower', kind: 'REGISTRY', eventDate: '2027-03-14', isShared: false })
        .expect(201);
      expect(created.body.isShared).toBe(false);
      list = (
        await http()
          .post(`/api/v1/me/lists/${created.body.id}/items`)
          .set(bearer(shopperToken))
          .send({ productId: products.house!.id, quantity: 2, note: 'Blue, please' })
          .expect(201)
      ).body as ShoppingListView;
      expect(list.items).toHaveLength(1);
      expect(list.items[0]).toMatchObject({ quantity: 2, note: 'Blue, please' });

      await http().get(`/api/v1/me/lists/${list.id}`).set(bearer(ownerToken)).expect(404);
      await http().get(`/api/v1/lists/${list.shareToken}`).expect(404);

      const containing = await http()
        .get(`/api/v1/me/lists/containing/${products.house!.id}`)
        .set(bearer(shopperToken))
        .expect(200);
      expect(containing.body).toEqual([list.id]);
    });

    it('opens to anyone with the link once shared, showing only a first name', async () => {
      await http()
        .patch(`/api/v1/me/lists/${list.id}`)
        .set(bearer(shopperToken))
        .send({ isShared: true })
        .expect(200);
      const shared = (await http().get(`/api/v1/lists/${list.shareToken}`).expect(200))
        .body as SharedListView;
      expect(shared.name).toBe('Baby shower');
      expect(shared.owner).toBe('Grace H.');
      expect(JSON.stringify(shared)).not.toContain('@example.com');
      expect(shared).not.toHaveProperty('shareToken');
    });

    it('stops the old link when it is reset', async () => {
      const reset = (
        await http()
          .post(`/api/v1/me/lists/${list.id}/reset-link`)
          .set(bearer(shopperToken))
          .expect(200)
      ).body as ShoppingListView;
      expect(reset.shareToken).not.toBe(list.shareToken);
      await http().get(`/api/v1/lists/${list.shareToken}`).expect(404);
      await http().get(`/api/v1/lists/${reset.shareToken}`).expect(200);
    });

    it('removes items and lists', async () => {
      const after = (
        await http()
          .delete(`/api/v1/me/lists/${list.id}/items/${products.house!.id}`)
          .set(bearer(shopperToken))
          .expect(200)
      ).body as ShoppingListView;
      expect(after.items).toEqual([]);
      await http().delete(`/api/v1/me/lists/${list.id}`).set(bearer(shopperToken)).expect(204);
      const mine = await http().get('/api/v1/me/lists').set(bearer(shopperToken)).expect(200);
      expect(mine.body).toEqual([]);
    });
  });
});
