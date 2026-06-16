import fs from 'fs';
import path from 'path';
import { getPool, closePool } from '../src/db/pool.js';

async function migrate() {
  const schemaSql = fs.readFileSync(
    path.resolve('src/db/schema.sql'),
    'utf-8',
  );
  const seedSql = fs.readFileSync(path.resolve('src/db/seed.sql'), 'utf-8');

  const pool = await getPool();

  console.log('Running schema.sql...');
  await pool.request().query(schemaSql);
  console.log('Schema applied.');

  console.log('Running seed.sql...');
  await pool.request().query(seedSql);
  console.log('Seed data inserted.');

  await closePool();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
