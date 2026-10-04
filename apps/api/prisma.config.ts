import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { withConnectionUrls } from './src/config/connection-urls';

// Same rules as the API: DATABASE_URL, or built from DATABASE_HOST/USER/PASSWORD/NAME (AWS).
const { DATABASE_URL } = withConnectionUrls(process.env);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: DATABASE_URL ?? '',
  },
  // Tables whose hand-written migrations own the structure; Prisma still generates their client
  // models but leaves them out of drift checks:
  // - product_search_docs: pgvector columns, a generated tsvector and an HNSW index (ADR-0009);
  // - audit_logs, product_events, outbox_events: partitioned by month, with their partitions in
  //   the "partitions" schema (ADR-0022).
  experimental: { externalTables: true },
  tables: {
    external: [
      'public.product_search_docs',
      'public.audit_logs',
      'public.product_events',
      'public.outbox_events',
    ],
  },
});
