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
  // product_search_docs uses pgvector columns, a generated tsvector and an HNSW index that
  // Prisma cannot describe. Its hand-written migration owns the structure; Prisma still
  // generates the client model but leaves the table out of drift checks (ADR-0009).
  experimental: { externalTables: true },
  tables: { external: ['product_search_docs'] },
});
