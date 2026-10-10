import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PAYMENTS_PROVIDER = 'fake';
process.env.AI_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type CheckoutResponse,
  type HelpConversation,
  type HelpTurn,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Grace Hopper',
  line1: '1 Navy Yard',
  city: 'Arlington',
  region: 'VA',
  postalCode: '22202',
  country: 'US',
};

describe('Help agent (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  let shopper: string;
  let other: string;
  let variantId: string;
  const numbers: Record<'shipped' | 'delivered' | 'fresh' | 'others', string> = {
    shipped: '',
    delivered: '',
    fresh: '',
    others: '',
  };

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function order(token: string, email: string): Promise<string> {
    await http()
      .post('/api/v1/cart/items')
      .set(bearer(token))
      .send({ variantId, quantity: 1 })
      .expect(201);
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(token))
        .send({ email, shippingAddress: address })
        .expect(201)
    ).body as CheckoutResponse;
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    await app.get(OutboxService).drain();
    return checkout.orderNumber;
  }

  const say = async (text: string, lang = 'en', token = shopper) =>
    (
      await http()
        .post('/api/v1/me/help/messages')
        .set(bearer(token))
        .set('Accept-Language', lang)
        .send({ text })
        .expect(200)
    ).body as HelpConversation;
  const act = async (body: object, token = shopper) =>
    (await http().post('/api/v1/me/help/actions').set(bearer(token)).send(body).expect(200))
      .body as HelpConversation;
  const last = (c: HelpConversation): HelpTurn => c.turns[c.turns.length - 1]!;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    shopper = await signUp(`help-shopper-${run}@example.com`);
    other = await signUp(`help-other-${run}@example.com`);
    const cat = await prisma.category.create({ data: { slug: `helpcat-${run}`, name: 'Help' } });
    const product = await prisma.product.create({
      data: {
        slug: `help-lamp-${run}`,
        title: `Help test lamp ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId: cat.id,
        variants: {
          create: {
            sku: `HELP-${run}`.toUpperCase(),
            title: 'Default',
            priceCents: 4_000,
            inventory: { create: { onHand: 50 } },
          },
        },
      },
      include: { variants: true },
    });
    variantId = product.variants[0]!.id;
    const email = `help-shopper-${run}@example.com`;
    numbers.delivered = await order(shopper, email);
    numbers.shipped = await order(shopper, email);
    numbers.fresh = await order(shopper, email);
    numbers.others = await order(other, `help-other-${run}@example.com`);
    const days = (n: number) => new Date(Date.now() - n * 86_400_000);
    await prisma.order.update({
      where: { number: numbers.delivered },
      data: {
        status: 'DELIVERED',
        placedAt: days(6),
        shippedAt: days(5),
        deliveredAt: days(3),
        trackingCarrier: 'USPS',
        trackingNumber: '9400100000000000000001',
      },
    });
    await prisma.order.update({
      where: { number: numbers.shipped },
      data: {
        status: 'SHIPPED',
        placedAt: days(2),
        shippedAt: days(1),
        trackingCarrier: 'UPS',
        trackingNumber: '1Z999AA10123456784',
      },
    });
  }, 90_000);

  afterAll(async () => {
    await prisma.supportRequest.deleteMany({ where: { email: { contains: `-${run}@` } } });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('needs sign-in, and starts with a welcome', async () => {
    await http().get('/api/v1/me/help').expect(401);
    const fresh = (await http().get('/api/v1/me/help').set(bearer(shopper)).expect(200))
      .body as HelpConversation;
    expect(fresh.id).toBeNull();
    expect(fresh.turns).toHaveLength(1);
    expect(fresh.turns[0]!.text).toMatch(/track a package/);
  });

  it('asks which order when several are on the way, then tracks the chosen one', async () => {
    let chat = await say('Where is my package?');
    let reply = last(chat);
    expect(reply.text).toMatch(/2 orders on the way/);
    expect(reply.buttons).toEqual(
      expect.arrayContaining([
        { kind: 'choose', intent: 'TRACK', orderNumber: numbers.shipped },
        { kind: 'choose', intent: 'TRACK', orderNumber: numbers.fresh },
      ]),
    );
    chat = await act({ kind: 'choose', intent: 'TRACK', orderNumber: numbers.shipped });
    reply = last(chat);
    expect(reply.text).toContain(`Order ${numbers.shipped} is on its way with UPS.`);
    expect(reply.orders[0]).toMatchObject({ number: numbers.shipped, status: 'SHIPPED' });
    expect(reply.buttons[0]).toMatchObject({ kind: 'track', orderNumber: numbers.shipped });
  });

  it('"cancel it" means the order being talked about; a shipped one can’t be', async () => {
    const reply = last(await say('ok can you cancel it'));
    expect(reply.text).toContain(`Order ${numbers.shipped} has already shipped`);
    expect(reply.buttons.some((b) => b.kind === 'cancel')).toBe(false);
  });

  it('cancels a just-placed order only when the button is pressed', async () => {
    let reply = last(await say(`please cancel ${numbers.fresh.toLowerCase()}`));
    expect(reply.text).toMatch(/You can still cancel order .* for about \d+ more minutes/);
    expect(reply.buttons[0]).toEqual({ kind: 'cancel', orderNumber: numbers.fresh });
    // Words alone never cancel.
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { number: numbers.fresh } })).status,
    ).toBe('PAID');
    reply = last(await act({ kind: 'cancel', orderNumber: numbers.fresh }));
    expect(reply.text).toContain(`Done: order ${numbers.fresh} is cancelled.`);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { number: numbers.fresh } })).status,
    ).toBe('CANCELLED');
  });

  it('points a return to the order page of the one order that can be returned', async () => {
    const reply = last(await say('I want to return the lamp, wrong colour'));
    expect(reply.text).toContain(`Order ${numbers.delivered} can be returned until`);
    expect(reply.buttons).toEqual([{ kind: 'return', orderNumber: numbers.delivered }]);
  });

  it('answers in the shopper’s language', async () => {
    const reply = last(await say('Où en est mon remboursement ?', 'fr'));
    // The cancelled order was refunded in full.
    expect(reply.text).toContain(`remboursés sur la commande ${numbers.fresh}`);
  });

  it('never shows or acts on someone else’s order', async () => {
    const reply = last(await say(`where is ${numbers.others}?`));
    expect(reply.text).toBe(`I couldn’t find order ${numbers.others} on your account.`);
    expect(reply.orders).toEqual([]);
    const acted = last(await act({ kind: 'cancel', orderNumber: numbers.others }));
    expect(acted.text).toContain('couldn’t find');
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { number: numbers.others } })).status,
    ).toBe('PAID');
  });

  it('hands the conversation to staff with the transcript, once', async () => {
    let chat = await say('I want to talk to a real person');
    expect(last(chat).buttons).toEqual([{ kind: 'handoff' }]);
    chat = await act({ kind: 'handoff' });
    expect(chat.status).toBe('HANDED_OFF');
    expect(chat.supportReference).toMatch(/^S-[A-Z0-9]{6}$/);
    expect(last(chat).text).toContain(chat.supportReference!);
    const ticket = await prisma.supportRequest.findUniqueOrThrow({
      where: { reference: chat.supportReference! },
    });
    expect(ticket).toMatchObject({ email: `help-shopper-${run}@example.com`, status: 'OPEN' });
    expect(ticket.subject).toBe('Help chat: Where is my package?');
    expect(ticket.message).toContain('Customer: Where is my package?');
    expect(ticket.message).toContain(`Help assistant: Done: order ${numbers.fresh} is cancelled.`);
    const again = last(await act({ kind: 'handoff' }));
    expect(again.text).toContain('already with our support team');
    expect(await prisma.supportRequest.count({ where: { email: ticket.email } })).toBe(1);
  });

  it('starts over with a clean conversation', async () => {
    await http().delete('/api/v1/me/help').set(bearer(shopper)).expect(204);
    const chat = (await http().get('/api/v1/me/help').set(bearer(shopper)).expect(200))
      .body as HelpConversation;
    expect(chat).toMatchObject({ id: null, status: 'OPEN', supportReference: null });
  });
});
