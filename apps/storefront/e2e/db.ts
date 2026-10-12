import { createRequire } from 'node:module';
import path from 'node:path';

// Direct database access for the few steps a browser can't do on its own (a parcel arriving).
// pg and dotenv come with the API; locally its .env has the connection string, CI sets it.
const api = createRequire(require.resolve('../../api/package.json'));
const pg = createRequire(api.resolve('@prisma/adapter-pg'))('pg') as {
  Client: new (options: { connectionString: string }) => {
    connect: () => Promise<void>;
    query: (sql: string, params: unknown[]) => Promise<{ rowCount: number | null }>;
    end: () => Promise<void>;
  };
};
if (!process.env.DATABASE_URL) {
  (api('dotenv') as { config: (o: object) => void }).config({
    path: path.resolve(__dirname, '../../api/.env'),
    quiet: true,
  });
}

/**
 * Marks an order delivered, as the carrier would (reviews need a delivered order, ADR-0029):
 * the order and every store's parcel in it.
 */
export async function markDelivered(orderNumber: string): Promise<void> {
  const url = (process.env.DATABASE_URL ?? '').replace(/\?.*$/, '');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      `UPDATE orders SET status = 'DELIVERED', shipped_at = now() - interval '2 days',
         delivered_at = now() WHERE number = $1`,
      [orderNumber],
    );
    if (!rowCount) throw new Error(`No order ${orderNumber}`);
    await client.query(
      `UPDATE seller_orders SET status = 'DELIVERED', delivered_at = now()
         WHERE order_id = (SELECT id FROM orders WHERE number = $1)`,
      [orderNumber],
    );
  } finally {
    await client.end();
  }
}
