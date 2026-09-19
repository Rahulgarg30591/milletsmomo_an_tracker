import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { E2E_DB_NAME, E2E_DATABASE_URL, ADMIN_DATABASE_URL } from './dbUrl';

async function run(connectionString: string, work: (c: Client) => Promise<void>) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await work(client);
  } finally {
    await client.end();
  }
}

/**
 * Builds a database for the browser tests to work against.
 *
 * It is separate from the one the integration tests use, so a failed E2E run
 * cannot leave rows behind that make a unit run fail for unrelated reasons.
 * The schema is rebuilt every run, which keeps the tests independent of
 * whatever the last run left behind.
 *
 * This runs as the first half of the backend's own start command rather than
 * as a Playwright globalSetup, because Playwright waits for webServer to
 * answer before globalSetup runs — and the server cannot answer its health
 * check until this database exists.
 */
export async function prepareDb() {
  const dbDir = path.resolve(process.cwd(), 'apps/backend/src/db');

  await run(ADMIN_DATABASE_URL, async (admin) => {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [E2E_DB_NAME]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${E2E_DB_NAME}"`);
    }
  });

  await run(E2E_DATABASE_URL, async (db) => {
    await db.query(fs.readFileSync(path.join(dbDir, 'schema.sql'), 'utf-8'));
    await db.query(fs.readFileSync(path.join(dbDir, 'seed.sql'), 'utf-8'));
  });
}

// Invoked directly by the webServer command.
prepareDb().then(
  () => process.exit(0),
  (err) => {
    console.error('E2E database preparation failed:', err);
    process.exit(1);
  },
);
