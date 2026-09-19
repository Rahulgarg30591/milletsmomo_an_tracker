import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(__dirname, '../src/db');

/**
 * Runs a whole .sql file as one statement batch.
 *
 * pg only accepts multiple statements in a single query when no parameters are
 * bound, which is the case for both of these files.
 */
async function runFile(fileName: string, label: string) {
  const pool = await getPool();
  const text = fs.readFileSync(path.join(dbDir, fileName), 'utf-8');
  console.log(`Running ${fileName}...`);
  await pool.query(text);
  console.log(label);
}

async function main() {
  const mode = process.argv[2];

  try {
    if (mode === 'seed') {
      await runFile('seed.sql', 'Seed data inserted.');
    } else {
      await runFile('schema.sql', 'Schema applied.');
      await runFile('seed.sql', 'Seed data inserted.');
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
