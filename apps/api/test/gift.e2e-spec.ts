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
  GIFT_WRAP_CENTS,
  type OrderView,
  type SellerOrderView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MailService } from '../src/modules/notifications/mail.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Mary Jackson',
  line1: '1 Langley Blvd',
  city: 'Hampton',
  region: 'VA',
  postalCode: '23681',
  country: 'US',
};

describe('Gift options (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  let shopper: string;
  let owner: string;
  const variants: Record<'own' | 'store', string> = { own: '', store: '' };
  const sent: { to: string; text: string; html?: string }[] = [];

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  const add = async (variantId: string) =>
    (
      await http()
        .post('/api/v1/cart/items')
        .set(bearer(shopper))
        .send({ variantId, quantity: 1 })
        .expect(201)
    ).body as Cart;
  const empty = async () => {
    for (const v of Object.values(variants)) {
      await http().delete(`/api/v1/cart/items/${v}`).set(bearer(shopper));
    }
  };
  const checkout = (gift: object, status = 201) =>
    http()
      .post('/api/v1/checkout')
      .set(bearer(shopper))
      .send({ email: `gift-shopper-${run}@example.com`, shippingAddress: address, gift })
      .expect(status);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const mail = app.get(MailService);
    const original = mail.send.bind(mail);
    jest.spyOn(mail, 'send').mockImplementation(async (message) => {
      sent.push({ to: message.to, text: message.text, html: message.html });
      return original(message);
    });
    shopper = await signUp(`gift-shopper-${run}@example.com`);
    owner = await signUp(`gift-owner-${run}@example.com`);
    const ownerRow = await prisma.user.findUniqueOrThrow({
      where: { email: `gift-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `giftshop-${run}`,
        displayName: 'Gift Shop',
        legalName: 'Gift Shop LLC',
        contactEmail: `gift-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: ownerRow.id, role: 'OWNER' } },
      },
    });
    const cat = await prisma.category.create({ data: { slug: `giftcat-${run}`, name: 'Gifts' } });
    for (const [key, sellerId] of [
      ['own', null],
      ['store', seller.id],
    ] as const) {
      const product = await prisma.product.create({
        data: {
          slug: `gift-${key}-${run}`,
          title: `Gift test ${key} ${run}`,
          description: 'A test listing.',
          status: 'ACTIVE',
          categoryId: cat.id,
          sellerId,
          variants: {
            create: {
              sku: `GIFT-${key}-${run}`.toUpperCase(),
              title: 'Default',
              priceCents: 3_000,
              inventory: { create: { onHand: 20 } },
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

  it('offers gift wrap only when NIXZORA ships something in the cart', async () => {
    expect((await add(variants.store)).giftWrap).toBeNull();
    // A store's items can't be wrapped.
    await checkout({ wrap: true }, 400);
    expect((await add(variants.own)).giftWrap).toEqual({ priceCents: GIFT_WRAP_CENTS });
  });

  it('adds the wrap to the total and keeps the message on the order', async () => {
    const res = (await checkout({ message: '  Happy birthday, Dot!  ', from: 'Mary', wrap: true }))
      .body as CheckoutResponse;
    expect(res.totals.giftWrapCents).toBe(GIFT_WRAP_CENTS);
    const t = res.totals;
    // Added after tax: goods, shipping and tax as usual, then the wrap.
    expect(t.totalCents).toBe(
      t.subtotalCents - t.discountCents + t.shippingCents + t.taxCents + GIFT_WRAP_CENTS,
    );
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.orderId } });
    expect(order).toMatchObject({
      isGift: true,
      giftMessage: 'Happy birthday, Dot!',
      giftFrom: 'Mary',
      giftWrapCents: GIFT_WRAP_CENTS,
      totalCents: t.totalCents,
    });
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: res.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    await app.get(OutboxService).drain();

    const view = (
      await http().get(`/api/v1/me/orders/${res.orderNumber}`).set(bearer(shopper)).expect(200)
    ).body as OrderView;
    expect(view.gift).toEqual({
      message: 'Happy birthday, Dot!',
      from: 'Mary',
      wrapCents: GIFT_WRAP_CENTS,
    });
    // The receipt shows the wrap and the card.
    const receipt = sent.find(
      (m) => m.to === `gift-shopper-${run}@example.com` && m.text.includes(res.orderNumber),
    );
    expect(receipt?.text).toContain('Gift wrap: $4.99');
    expect(receipt?.html).toContain('Happy birthday, Dot!');

    // The store packing its part sees the card and "no prices", not the wrap.
    const parts = (await http().get('/api/v1/seller/orders').set(bearer(owner)).expect(200)).body
      .items as SellerOrderView[];
    const part = parts.find((p) => p.orderNumber === res.orderNumber)!;
    expect(part.gift).toEqual({ message: 'Happy birthday, Dot!', from: 'Mary' });
  });

  it('a gift without wrap costs nothing extra, and a long message is refused', async () => {
    await empty();
    await add(variants.own);
    await checkout({ message: 'x'.repeat(301) }, 400);
    const res = (await checkout({})).body as CheckoutResponse;
    expect(res.totals.giftWrapCents).toBeUndefined();
    expect(await prisma.order.findUniqueOrThrow({ where: { id: res.orderId } })).toMatchObject({
      isGift: true,
      giftMessage: null,
      giftWrapCents: 0,
    });
  });
});
