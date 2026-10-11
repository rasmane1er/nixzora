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
  type OrderView,
  addDays,
  easternToday,
  type ProductDetail,
  releaseStart,
  deliveryWindow,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Katherine Johnson',
  line1: '1 Langley Blvd',
  city: 'Hampton',
  region: 'VA',
  postalCode: '23681',
  country: 'US',
};

describe('Pre-orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const products: Record<string, { id: string; variantId: string }> = {};
  let ownerToken: string;
  let shopperToken: string;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function product(
    key: string,
    categoryId: string,
    seller: string | null,
    priceCents: number,
    options = 1,
  ) {
    const created = await prisma.product.create({
      data: {
        slug: `po-${key}-${run}`,
        title: `Preorder test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId: seller,
        variants: {
          create: Array.from({ length: options }, (_, i) => ({
            sku: `PO-${key}-${i}-${run}`.toUpperCase(),
            title: `Option ${i + 1}`,
            priceCents,
            inventory: { create: { onHand: 20 } },
          })),
        },
      },
      include: { variants: true },
    });
    products[key] = { id: created.id, variantId: created.variants[0]!.id };
  }

  const add = async (token: string, key: string, quantity = 1) =>
    (
      await http()
        .post('/api/v1/cart/items')
        .set(bearer(token))
        .send({ variantId: products[key]!.variantId, quantity })
        .expect(201)
    ).body as Cart;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    ownerToken = await signUp(`po-owner-${run}@example.com`);
    shopperToken = await signUp(`po-shopper-${run}@example.com`);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `po-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `poshop-${run}`,
        displayName: 'Preorder Shop',
        legalName: 'Preorder Shop LLC',
        contactEmail: `po-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    const cat = await prisma.category.create({ data: { slug: `pocat-${run}`, name: 'Preorders' } });
    await product('console', cat.id, seller.id, 40_000);
    await product('cable', cat.id, seller.id, 1_000);
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const release = addDays(easternToday(), 20);
  const edit = (body: object, status: number) =>
    http()
      .patch(`/api/v1/seller/products/${products.console!.id}`)
      .set(bearer(ownerToken))
      .send(body)
      .expect(status);

  it('takes a release date after today and within 180 days', async () => {
    await edit({ releaseDate: easternToday() }, 400);
    await edit({ releaseDate: addDays(easternToday(), 181) }, 400);
    const detail = (await edit({ releaseDate: release }, 200)).body as ProductDetail;
    expect(detail.releaseDate).toBe(release);
    // Saving the form again with the same date is fine; a pre-order needs no new review.
    await edit({ releaseDate: release }, 200);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: products.console!.id } })).status,
    ).toBe('ACTIVE');
  });

  it('shows it as a pre-order that arrives after its release day', async () => {
    const detail = (await http().get(`/api/v1/catalog/products/po-console-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.preorder).toEqual({ releaseDate: release });
    const { handlingDays } = await prisma.seller.findUniqueOrThrow({
      where: { handle: `poshop-${run}` },
    });
    expect(detail.delivery).toEqual(deliveryWindow(releaseStart(release), handlingDays));
  });

  let order: OrderView;

  it('sells it now; the order ships from the release day', async () => {
    let cart = await add(shopperToken, 'cable');
    const soon = cart.delivery!;
    cart = await add(shopperToken, 'console');
    expect(cart.lines.find((l) => l.productId === products.console!.id)?.releaseDate).toBe(release);
    // One order: everything arrives once the pre-order ships.
    expect(cart.delivery!.earliest > soon.earliest).toBe(true);
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(shopperToken))
        .send({ email: `po-shopper-${run}@example.com`, shippingAddress: address })
        .expect(201)
    ).body as CheckoutResponse;
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    await app.get(OutboxService).drain();
    order = (
      await http()
        .get(`/api/v1/orders/${checkout.orderNumber}`)
        .set(bearer(shopperToken))
        .expect(200)
    ).body as OrderView;
    expect(order.preorderShipsOn).toBe(release);
    expect((order.estimatedDelivery?.earliest ?? '') >= release).toBe(true);
    const seller = (await http().get('/api/v1/seller/orders').set(bearer(ownerToken)).expect(200))
      .body as {
      items: { orderNumber: string; items: { sku: string; shipsOn?: string | null }[] }[];
    };
    const part = seller.items.find((o) => o.orderNumber === checkout.orderNumber)!;
    expect(part.items.map((i) => i.shipsOn).sort()).toEqual([release, null].sort());
  });

  it('can be cancelled until the release day, with the units back on sale', async () => {
    // Long after the usual 30 minutes.
    await prisma.order.update({
      where: { number: order.number },
      data: { placedAt: new Date(Date.now() - 3 * 86_400_000) },
    });
    const view = (
      await http().get(`/api/v1/orders/${order.number}`).set(bearer(shopperToken)).expect(200)
    ).body as OrderView;
    expect(view.cancellableUntil?.startsWith(release)).toBe(true);
    const before = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId: products.console!.variantId },
    });
    const cancelled = (
      await http()
        .post(`/api/v1/orders/${order.number}/cancel`)
        .set(bearer(shopperToken))
        .expect(200)
    ).body as OrderView;
    expect(cancelled.status).toMatch(/CANCELLED|REFUNDED/);
    const after = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId: products.console!.variantId },
    });
    expect(after.onHand).toBe(before.onHand + 1);
  });

  it('is an ordinary product again once the date is cleared', async () => {
    await edit({ releaseDate: null }, 200);
    const detail = (await http().get(`/api/v1/catalog/products/po-console-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.preorder).toBeUndefined();
  });
});
