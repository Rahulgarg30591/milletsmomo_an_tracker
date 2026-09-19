import { beforeEach, afterAll } from 'vitest';
import { closePool, query } from '../../../src/db/pool.js';
import { TRANSACTIONAL_TABLES } from './testDb.js';

/**
 * Empties every table that holds daily activity before each test.
 *
 * TRUNCATE ... RESTART IDENTITY keeps generated ids predictable between tests,
 * and CASCADE covers the foreign keys rather than relying on delete order.
 */
beforeEach(async () => {
  await query(`TRUNCATE ${TRANSACTIONAL_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await closePool();
});
