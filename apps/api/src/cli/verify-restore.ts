/**
 * Checks a restored database before anyone uses it (disaster-recovery drill, or a real restore).
 * Prints one JSON report on stdout and exits 1 when a check fails. Read-only.
 *
 *   DATABASE_URL=… node dist/cli/verify-restore.js [--restore-time 2027-03-01T14:05:00Z]
 *     [--expect-migration 20271008000000_sign_up_details]
 *
 * In AWS it runs as a one-off task of the migrate image (scripts/dr/restore-drill.sh), which
 * builds DATABASE_URL from DATABASE_HOST and the database secret.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { withConnectionUrls } from '../config/connection-urls';
import { checkRestore } from '../database/restore-check';
import { PrismaClient } from '../generated/prisma/client';

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : undefined;
}

async function main(): Promise<void> {
  const url = withConnectionUrls(process.env).DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL (or DATABASE_HOST, DATABASE_USER, DATABASE_NAME).');
  const restoreTime = flag('--restore-time');
  if (restoreTime && Number.isNaN(Date.parse(restoreTime))) {
    throw new Error(`--restore-time is not a date: ${restoreTime}`);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const report = await checkRestore(prisma, {
      restoreTime: restoreTime ? new Date(restoreTime) : undefined,
      expectMigration: flag('--expect-migration'),
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
