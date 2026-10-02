import { type PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end suites run against the development database, so each one removes what it
 * created (everything is tagged with the run id). Audit log rows stay: they are append-only.
 */
export async function removeTestData(prisma: PrismaService, run: string): Promise<void> {
  const tag = `${run}`;
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { email: { contains: tag } },
        { items: { some: { sku: { contains: tag.toUpperCase() } } } },
      ],
    },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  await prisma.refund.deleteMany({ where: { payment: { orderId: { in: orderIds } } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });

  const categories = await prisma.category.findMany({
    where: { slug: { endsWith: tag } },
    select: { id: true, parentId: true },
  });
  await prisma.product.deleteMany({
    where: {
      OR: [{ categoryId: { in: categories.map((c) => c.id) } }, { slug: { endsWith: tag } }],
    },
  });
  // Children before parents.
  const ids = new Set(categories.map((c) => c.id));
  const depth = (id: string | null): number => {
    const parent = categories.find((c) => c.id === id)?.parentId ?? null;
    return parent && ids.has(parent) ? 1 + depth(parent) : 0;
  };
  for (const category of [...categories].sort((a, b) => depth(b.id) - depth(a.id))) {
    await prisma.category.delete({ where: { id: category.id } });
  }
  await prisma.brand.deleteMany({ where: { slug: { endsWith: tag } } });
  await prisma.user.deleteMany({ where: { email: { contains: `-${tag}` } } });
}
