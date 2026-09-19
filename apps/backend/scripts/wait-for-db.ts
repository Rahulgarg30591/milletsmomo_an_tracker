import { Client } from 'pg';
import '../src/db/pool.js';

const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 3000;

async function waitForDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  // Logged without the password so a CI transcript cannot leak it.
  const target = new URL(connectionString);
  console.log(`Waiting for Postgres at ${target.host}${target.pathname}...`);

  for (let i = 1; i <= MAX_RETRIES; i++) {
    const client = new Client({
      connectionString,
      ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('Postgres is ready.');
      return;
    } catch {
      await client.end().catch(() => {});
      console.log(`  Attempt ${i}/${MAX_RETRIES} — not ready, retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw new Error(`Postgres not available after ${MAX_RETRIES} attempts`);
}

waitForDb().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
