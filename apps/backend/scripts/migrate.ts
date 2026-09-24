import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(__dirname, '../src/db');
const migrationsDir = path.join(dbDir, 'migrations');

/**
 * Runs a whole .sql file as one statement batch.
 *
 * pg only accepts multiple statements in a single query when no parameters are
 * bound, which is the case for both of these files.
 */
async function runFile(fileName: string, label: string, dir = dbDir) {
  const pool = await getPool();
  const text = fs.readFileSync(path.join(dir, fileName), 'utf-8');
  console.log(`Running ${fileName}...`);
  await pool.query(text);
  console.log(label);
}

async function main() {
  const mode = process.argv[2];

  try {
    if (mode === 'seed') {
      await runFile('seed.sql', 'Seed data inserted.');
    } else if (mode === 'apply') {
      // Additive changes for a database that already holds data, which
      // schema.sql would wipe. basename keeps the file inside migrations/.
      const file = process.argv[3];
      if (!file) throw new Error('Usage: migrate apply <file in src/db/migrations>');
      await runFile(path.basename(file), 'Migration applied.', migrationsDir);
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
