import { Client } from 'pg';

const HOST = process.env.TEST_DB_HOST ?? 'localhost';
const PORT = process.env.MOMO_DB_PORT ?? '5432';
const USER = process.env.TEST_DB_USER ?? 'momo';
const PASSWORD = process.env.TEST_DB_PASSWORD ?? 'MomoDev2024!';
const ADMIN_DB = process.env.TEST_DB_ADMIN ?? 'millets_momo';

/** A database of its own, so a test run never touches the development data. */
export const TEST_DB_NAME = process.env.TEST_DB_NAME ?? 'millets_momo_test';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${USER}:${encodeURIComponent(PASSWORD)}@${HOST}:${PORT}/${TEST_DB_NAME}`;

export function adminConnectionString(): string {
  return `postgresql://${USER}:${encodeURIComponent(PASSWORD)}@${HOST}:${PORT}/${ADMIN_DB}`;
}

export async function withClient<T>(
  connectionString: string,
  work: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/**
 * Tables holding per-day activity, in an order that respects foreign keys.
 *
 * `users`, `menu_items` and `supply_items` are deliberately absent: they are
 * reference data created once by the seed, and every test depends on the ids
 * staying stable (order_items.menu_item_id is a foreign key, and the beverage
 * ids must keep matching buildMenu()).
 */
export const TRANSACTIONAL_TABLES = [
  'client_activity_logs',
  'staff_operation_logs',
  'day_expenses',
  'daily_payment_settlements',
  'daily_closing_stock',
  'supply_verifications',
  'supply_order_logs',
  'daily_supply_order_items',
  'daily_supply_orders',
  'order_items',
  'orders',
];
