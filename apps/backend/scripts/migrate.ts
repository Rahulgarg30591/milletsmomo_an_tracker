import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(__dirname, '../src/db');

async function runSchema() {
  const pool = await getPool();
  const sql = fs.readFileSync(path.join(dbDir, 'schema.sql'), 'utf-8');
  console.log('Running schema.sql...');
  await pool.request().query(sql);
  console.log('Schema applied.');
}

async function runSeed() {
  const pool = await getPool();
  const sql = fs.readFileSync(path.join(dbDir, 'seed.sql'), 'utf-8');
  console.log('Running seed.sql...');
  await pool.request().query(sql);
  console.log('Seed data inserted.');
}

async function main() {
  const mode = process.argv[2];

  try {
    if (mode === 'seed') {
      await runSeed();
    } else {
      await runSchema();
      await runSeed();
    }
    console.log('Migration complete.');
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});