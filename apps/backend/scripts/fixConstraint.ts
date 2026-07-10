import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(__dirname, '../src/db');

async function main() {
  const pool = await getPool();
  const sql = fs.readFileSync(path.join(dbDir, 'fix_constraint.sql'), 'utf-8');
  console.log('Running fix_constraint.sql on production DB...');
  await pool.request().query(sql);
  console.log('Constraint fix complete.');
  await closePool();
}

main().catch((err) => {
  console.error('Fix failed:', err);
  process.exit(1);
});
