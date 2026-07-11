import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(__dirname, '../src/db');

async function main() {
  const pool = await getPool();
  const sql = fs.readFileSync(path.join(dbDir, 'migrate_expenses.sql'), 'utf-8');
  console.log('Running migrate_expenses.sql (additive, data-safe)...');
  await pool.request().query(sql);
  console.log('Migration complete.');
  await closePool();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
