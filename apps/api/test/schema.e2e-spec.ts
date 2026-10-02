import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { type PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

// Exercises every core table through the generated client so a mismatch between
// schema.prisma and the SQL migrations fails CI, and proves the audit log is append-only.
describe('database schema (e2e)', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
  });
  const run = Date.now().toString(36);

  afterAll(async () => {
    await removeTestData(prisma as unknown as PrismaService, run);
    await prisma.rolePermission.deleteMany({ where: { role: { key: `customer-${run}` } } });
    await prisma.role.deleteMany({ where: { key: `customer-${run}` } });
    await prisma.permission.deleteMany({ where: { key: `orders.read.own-${run}` } });
    await prisma.$disconnect();
  });

  it('stores a catalog item, a customer and a paid order end to end', async () => {
    const category = await prisma.category.create({
      data: { slug: `laptops-${run}`, name: 'Laptops', isActive: false },
    });
    const brand = await prisma.brand.create({ data: { slug: `kestrel-${run}`, name: 'Kestrel' } });
    const product = await prisma.product.create({
      data: {
        slug: `kestrel-14-pro-${run}`,
        title: 'Kestrel 14 Pro',
        description: 'Developer laptop',
        status: 'ACTIVE',
        categoryId: category.id,
        brandId: brand.id,
        attributes: { ram_gb: 32, storage_gb: 1024 },
        images: { create: [{ storageKey: 'products/kestrel/1.jpg', alt: 'Front view' }] },
        variants: {
          create: [
            {
              sku: `KES14-32-1T-${run}`,
              title: '32GB / 1TB / Graphite',
              options: { memory: '32GB' },
              priceCents: 134900,
              compareAtCents: 149900,
              inventory: { create: { onHand: 25 } },
            },
          ],
        },
      },
      include: { variants: { include: { inventory: true } } },
    });
    const variant = product.variants[0]!;
    expect(variant.inventory?.onHand).toBe(25);
    expect(variant.id).toMatch(/^[0-9a-f-]{36}$/);

    const role = await prisma.role.create({
      data: {
        key: `customer-${run}`,
        name: 'Customer',
        permissions: { create: [{ permission: { create: { key: `orders.read.own-${run}` } } }] },
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `buyer-${run}@example.com`,
        roles: { create: [{ roleId: role.id }] },
        addresses: {
          create: [
            {
              fullName: 'Test Buyer',
              line1: '1 Example St',
              city: 'Washington',
              region: 'DC',
              postalCode: '20001',
              country: 'US',
            },
          ],
        },
        sessions: {
          create: [
            { refreshTokenHash: `hash-${run}`, expiresAt: new Date(Date.now() + 86_400_000) },
          ],
        },
      },
    });

    const order = await prisma.order.create({
      data: {
        number: `NX-${run}`,
        userId: user.id,
        email: user.email,
        subtotalCents: 134900,
        taxCents: 8094,
        totalCents: 142994,
        shippingAddress: { line1: '1 Example St', city: 'Washington', postalCode: '20001' },
        items: {
          create: [
            {
              variantId: variant.id,
              productTitle: product.title,
              variantTitle: variant.title,
              sku: variant.sku,
              unitPriceCents: 134900,
              quantity: 1,
              totalCents: 134900,
            },
          ],
        },
        payments: {
          create: [
            {
              provider: 'STRIPE',
              providerPaymentId: `pi_${run}`,
              status: 'SUCCEEDED',
              amountCents: 142994,
              currency: 'USD',
            },
          ],
        },
      },
      include: { items: true, payments: true },
    });

    await prisma.inventoryReservation.create({
      data: { variantId: variant.id, orderId: order.id, quantity: 1, expiresAt: new Date() },
    });
    await prisma.processedWebhookEvent.create({ data: { id: `evt_${run}`, provider: 'STRIPE' } });
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'order',
        aggregateId: order.id,
        type: 'order.paid',
        payload: { orderId: order.id },
      },
    });

    expect(order.items).toHaveLength(1);
    expect(order.payments[0]?.status).toBe('SUCCEEDED');
  });

  it('accepts new audit entries but blocks updates and deletes', async () => {
    const entry = await prisma.auditLog.create({
      data: { actorType: 'SYSTEM', action: 'test.schema.verified', metadata: { run } },
    });
    expect(typeof entry.id).toBe('bigint');

    await expect(
      prisma.auditLog.update({ where: { id: entry.id }, data: { action: 'tampered' } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(
      /append-only/,
    );
  });
});
