import { type ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { type PrismaService } from '../../prisma/prisma.service';
import { type MailMessage, type MailService } from '../notifications/mail.service';
import { type OutboxService } from '../outbox/outbox.service';
import { OrderEmails } from './order-emails';
import { type OrderRow } from './order-links';

const order = (over: Partial<OrderRow> = {}): OrderRow =>
  ({
    id: '0190a1b2-0000-7000-8000-000000000001',
    number: 'NX-ABC123',
    userId: null,
    email: 'guest@example.com',
    status: 'PAID',
    currency: 'USD',
    subtotalCents: 123_450,
    shippingCents: 0,
    taxCents: 9_876,
    discountCents: 0,
    couponCode: null,
    language: 'en',
    refundedCents: 0,
    labelUrl: null,
    postageCents: null,
    totalCents: 133_326,
    shippingAddress: {
      fullName: 'Ada Lovelace',
      line1: '1 Main St',
      city: 'Brandywine',
      region: 'MD',
      postalCode: '20613',
      country: 'US',
    },
    billingAddress: null,
    trackingCarrier: null,
    trackingNumber: null,
    cancelReason: null,
    placedAt: new Date('2027-10-01T12:00:00Z'),
    fulfillingAt: null,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    createdAt: new Date('2027-10-01T11:59:00Z'),
    updatedAt: new Date('2027-10-01T12:00:00Z'),
    items: [
      {
        id: 'item-1',
        orderId: '0190a1b2-0000-7000-8000-000000000001',
        variantId: 'variant-1',
        productTitle: 'Kestrel 14 Pro',
        variantTitle: '32GB / 1TB',
        sku: 'KES14',
        unitPriceCents: 123_450,
        quantity: 1,
        totalCents: 123_450,
        sellerId: null,
      },
    ],
    sellerOrders: [],
    ...over,
  }) as unknown as OrderRow;

function setup(row: OrderRow, userLanguage?: string) {
  const handlers = new Map<string, (event: unknown) => Promise<void>>();
  const outbox = {
    on: (type: string, handler: (event: unknown) => Promise<void>) => handlers.set(type, handler),
  } as unknown as OutboxService;
  const sent: MailMessage[] = [];
  const mail = {
    send: (message: MailMessage) => {
      sent.push(message);
      return Promise.resolve();
    },
  } as unknown as MailService;
  const prisma = {
    order: { findUnique: () => Promise.resolve(row) },
    user: {
      findUnique: () => Promise.resolve(userLanguage ? { language: userLanguage } : null),
    },
  } as unknown as PrismaService;
  const config = {
    get: (key: string) =>
      key === 'WEB_APP_URL' ? 'https://nixzora.test' : 'order-link-secret-for-tests',
  } as unknown as ConfigService<Env, true>;
  new OrderEmails(outbox, mail, prisma, config).onModuleInit();
  const paid = () => handlers.get('order.paid')!({ aggregateId: row.id, payload: {} });
  return { paid, sent };
}

describe('OrderEmails', () => {
  it('keeps the English receipt exactly as before', async () => {
    const { paid, sent } = setup(order());
    await paid();
    expect(sent[0]!.subject).toBe('Your NIXZORA order NX-ABC123');
    expect(sent[0]!.template).toBe('orders.receipt');
    expect(sent[0]!.text).toMatch(
      /^Thanks for your order!\n\nOrder NX-ABC123\n\n {2}1 × Kestrel 14 Pro \(32GB \/ 1TB\) — \$1,234\.50\n\nSubtotal: \$1,234\.50\nShipping: Free\nTax: \$98\.76\nTotal: \$1,333\.26\n\nShipping to:\nAda Lovelace\n1 Main St\nBrandywine, MD 20613\n\nTrack your order: https:\/\/nixzora\.test\/orders\/NX-ABC123\?token=[\w-]{43}\n$/,
    );
  });

  it('writes to a guest in the language they checked out in, with French amounts', async () => {
    const { paid, sent } = setup(order({ language: 'fr' }));
    await paid();
    const message = sent[0]!;
    expect(message.subject).toBe('Votre commande NIXZORA NX-ABC123');
    expect(message.text).toContain('Merci pour votre commande !');
    expect(message.text).toContain('Livraison : Gratuite');
    // fr-FR: narrow no-break spaces as thousands separator, comma decimals, "$US".
    expect(message.text).toMatch(/Total : 1\s333,26\s\$US/);
    expect(message.template).toBe('orders.receipt');
    expect(message.data).toEqual({ number: 'NX-ABC123', link: expect.any(String) });
  });

  it("prefers the account's language for signed-in customers", async () => {
    const { paid, sent } = setup(order({ userId: 'user-1', language: 'fr' }), 'es');
    await paid();
    expect(sent[0]!.subject).toBe('Tu pedido de NIXZORA NX-ABC123');
    expect(sent[0]!.text).toContain('¡Gracias por tu pedido!');
  });
});
