import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type AdminConversationView,
  AuthTokensSchema,
  type ConversationSummary,
  type ConversationView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { redactContacts } from '../src/modules/messaging/messaging.service';
import { MailService } from '../src/modules/notifications/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Messages between customers and stores (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  let customer: string;
  let stranger: string;
  let owner: string;
  let otherOwner: string;
  let staff: string;
  let productId: string;
  let otherProductId: string;
  let thread: ConversationView;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function store(key: string, ownerEmail: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });
    return prisma.seller.create({
      data: {
        handle: `${key}-${run}`,
        displayName: `${key} shop`,
        legalName: `${key} LLC`,
        contactEmail: `${key}-contact-${run}@example.com`,
        status: 'ACTIVE',
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    customer = await signUp(`msg-customer-${run}@example.com`);
    await prisma.user.update({
      where: { email: `msg-customer-${run}@example.com` },
      data: { firstName: 'Grace', lastName: 'Hopper' },
    });
    stranger = await signUp(`msg-stranger-${run}@example.com`);
    owner = await signUp(`msg-owner-${run}@example.com`);
    otherOwner = await signUp(`msg-other-${run}@example.com`);
    const staffEmail = `msg-staff-${run}@example.com`;
    staff = await signUp(staffEmail);
    const staffUser = await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } });
    await prisma.userRole.create({
      data: { user: { connect: { id: staffUser.id } }, role: { connect: { key: 'admin' } } },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(staff)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(staff))
      .send({ code: totp(setup.body.secret) })
      .expect(201);

    const shop = await store('msgshop', `msg-owner-${run}@example.com`);
    const other = await store('othermsg', `msg-other-${run}@example.com`);
    const cat = await prisma.category.create({ data: { slug: `msgcat-${run}`, name: 'Msg' } });
    const make = (slug: string, sellerId: string) =>
      prisma.product.create({
        data: {
          slug: `${slug}-${run}`,
          title: `Kettle ${slug} ${run}`,
          description: 'A test listing.',
          status: 'ACTIVE',
          categoryId: cat.id,
          sellerId,
        },
      });
    productId = (await make('msgkettle', shop.id)).id;
    otherProductId = (await make('otherkettle', other.id)).id;
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  it('takes contact details out of messages', () => {
    expect(redactContacts('Mail me at ada@example.com or call +1 (301) 555-0199 today')).toEqual({
      body: 'Mail me at [removed] or call [removed] today',
      redacted: true,
    });
    expect(redactContacts('Order of 3, size 10')).toEqual({
      body: 'Order of 3, size 10',
      redacted: false,
    });
  });

  it('lets a customer ask a store about its product', async () => {
    await http()
      .post('/api/v1/me/messages')
      .set(bearer(customer))
      .send({ sellerHandle: `msgshop-${run}`, productId: otherProductId, body: 'Hi' })
      .expect(400);
    await http()
      .post('/api/v1/me/messages')
      .set(bearer(owner))
      .send({ sellerHandle: `msgshop-${run}`, body: 'Talking to myself' })
      .expect(400);

    thread = (
      await http()
        .post('/api/v1/me/messages')
        .set(bearer(customer))
        .send({
          sellerHandle: `msgshop-${run}`,
          productId,
          body: 'Does it fit a 2 L jug? Email me at grace@example.com',
        })
        .expect(201)
    ).body as ConversationView;
    expect(thread.subject).toContain('Kettle msgkettle');
    expect(thread.messages[0]).toMatchObject({ author: 'CUSTOMER', redacted: true });
    expect(thread.messages[0]!.body).not.toContain('@');
    expect(mail.lastTo(`msgshop-contact-${run}@example.com`, 'messages.new')?.subject).toContain(
      'Grace H.',
    );

    // Same store and product: the same thread.
    const again = (
      await http()
        .post('/api/v1/me/messages')
        .set(bearer(customer))
        .send({ sellerHandle: `msgshop-${run}`, productId, body: 'Also, is it BPA free?' })
        .expect(201)
    ).body as ConversationView;
    expect(again.id).toBe(thread.id);
    expect(again.messages).toHaveLength(2);
  });

  it('shows the store the thread, never the customer’s email, and tracks unread', async () => {
    const inbox = (await http().get('/api/v1/seller/messages').set(bearer(owner)).expect(200))
      .body as ConversationSummary[];
    expect(inbox[0]).toMatchObject({ id: thread.id, with: 'Grace H.', unread: true });
    expect(JSON.stringify(inbox)).not.toContain(`msg-customer-${run}`);

    await http()
      .post(`/api/v1/seller/messages/${thread.id}`)
      .set(bearer(owner))
      .send({ body: 'Yes to both!' })
      .expect(201);
    expect(mail.lastTo(`msg-customer-${run}@example.com`, 'messages.new')?.text).toContain(
      'Yes to both!',
    );
    const mine = (await http().get('/api/v1/me/messages').set(bearer(customer)).expect(200))
      .body as ConversationSummary[];
    expect(mine[0]).toMatchObject({ unread: true, with: 'msgshop shop' });
    await http().get(`/api/v1/me/messages/${thread.id}`).set(bearer(customer)).expect(200);
    const read = (await http().get('/api/v1/me/messages').set(bearer(customer)).expect(200))
      .body as ConversationSummary[];
    expect(read[0]!.unread).toBe(false);
  });

  it('keeps threads private to the two sides', async () => {
    await http().get(`/api/v1/me/messages/${thread.id}`).set(bearer(stranger)).expect(404);
    await http().get(`/api/v1/seller/messages/${thread.id}`).set(bearer(otherOwner)).expect(404);
    await http().get('/api/v1/seller/messages').set(bearer(stranger)).expect(403);
    await http().get('/api/v1/admin/messages').set(bearer(customer)).expect(403);
  });

  it('lets either side report a thread, and staff hide it', async () => {
    await http()
      .post(`/api/v1/seller/messages/${thread.id}/report`)
      .set(bearer(owner))
      .send({ reason: 'Asked me to pay outside NIXZORA' })
      .expect(200);
    const reported = (await http().get('/api/v1/admin/messages').set(bearer(staff)).expect(200))
      .body as AdminConversationView[];
    const found = reported.find((c) => c.id === thread.id);
    expect(found).toMatchObject({
      reportReason: 'Asked me to pay outside NIXZORA',
      customerEmail: `msg-customer-${run}@example.com`,
    });
    await http()
      .post(`/api/v1/admin/messages/${thread.id}/moderate`)
      .set(bearer(staff))
      .send({ action: 'hide' })
      .expect(200);
    const mine = (await http().get('/api/v1/me/messages').set(bearer(customer)).expect(200))
      .body as ConversationSummary[];
    expect(mine.map((c) => c.id)).not.toContain(thread.id);
    await http()
      .post(`/api/v1/me/messages/${thread.id}`)
      .set(bearer(customer))
      .send({ body: 'Hello?' })
      .expect(404);
  });
});
