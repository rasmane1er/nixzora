/**
 * Creates the first Ops Center administrator (or promotes an existing account).
 *
 *   pnpm --filter @nixzora/api admin:create you@example.com
 *
 * A strong temporary password is printed once. Sign in at the Ops Center,
 * set up two-step verification (required for staff), then change the password.
 */
import 'dotenv/config';
import { withConnectionUrls } from '../src/config/connection-urls';
import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { EmailSchema } from '@nixzora/validation';
import { PrismaClient } from '../src/generated/prisma/client';

async function main(): Promise<void> {
  const parsed = EmailSchema.safeParse(process.argv[2] ?? '');
  if (!parsed.success) {
    console.error('Usage: pnpm --filter @nixzora/api admin:create you@example.com');
    process.exitCode = 1;
    return;
  }
  const email = parsed.data;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: withConnectionUrls(process.env).DATABASE_URL as string,
    }),
  });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    let password: string | null = null;

    const user =
      existing ??
      (await prisma.user.create({
        data: {
          email,
          passwordHash: await hash((password = randomBytes(18).toString('base64url')), {
            memoryCost: 19_456,
            timeCost: 2,
            parallelism: 1,
          }),
          emailVerifiedAt: new Date(),
          roles: { create: [{ role: { connect: { key: 'customer' } } }] },
        },
      }));

    const admin = await prisma.role.findUniqueOrThrow({ where: { key: 'admin' } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: admin.id } },
      create: { userId: user.id, roleId: admin.id },
      update: {},
    });
    await prisma.auditLog.create({
      data: {
        actorType: 'SYSTEM',
        action: 'users.role.granted',
        entityType: 'user',
        entityId: user.id,
        metadata: { roleKey: 'admin', via: 'admin:create script' },
      },
    });

    console.warn(`\n✔ ${email} is now an administrator.`);
    if (password) {
      console.warn(`  Temporary password (shown once): ${password}`);
      console.warn('  Sign in, turn on two-step verification, then change this password.\n');
    } else {
      console.warn('  Existing account: keep using its current password.\n');
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
