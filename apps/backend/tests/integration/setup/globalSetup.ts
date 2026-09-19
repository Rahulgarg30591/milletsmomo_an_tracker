import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TEST_DB_NAME,
  TEST_DATABASE_URL,
  adminConnectionString,
  withClient,
} from './testDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(__dirname, '../../../src/db');

/**
 * Creates the test database and builds it from the real schema and seed.
 *
 * Using the production schema.sql rather than a hand-written fixture is the
 * point of these tests: a column renamed there but not in a query is exactly
 * the kind of drift a mocked test cannot see.
 */
export default async function setup() {
  await withClient(adminConnectionString(), async (admin) => {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB_NAME]);
    if (exists.rowCount === 0) {
      // Identifier cannot be parameterised; the name is ours, not user input.
      await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  });

  await withClient(TEST_DATABASE_URL, async (db) => {
    await db.query(fs.readFileSync(path.join(dbDir, 'schema.sql'), 'utf-8'));
    await db.query(fs.readFileSync(path.join(dbDir, 'seed.sql'), 'utf-8'));
  });
}
