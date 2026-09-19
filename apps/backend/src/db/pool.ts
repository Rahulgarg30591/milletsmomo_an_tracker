import { Pool, types as pgTypes, type PoolClient, type QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvConfig() {
  const env = process.env.NODE_ENV || 'development';
  const envFile = env === 'production' ? '.env.production' : '.env.development';
  const searchPaths = [
    path.resolve(__dirname, '..', envFile),
    path.resolve(process.cwd(), envFile),
    path.resolve(process.cwd(), 'apps/backend', envFile),
  ];
  for (const envPath of searchPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      return;
    }
  }
}

function loadLocalSettings() {
  if (process.env.DATABASE_URL) return;
  const settingsPath = path.resolve(__dirname, '../../local.settings.json');
  if (!fs.existsSync(settingsPath)) return;
  const values = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')).Values || {};
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key] && typeof value === 'string') {
      process.env[key] = value;
    }
  }
}

loadEnvConfig();
if (process.env.NODE_ENV !== 'production') {
  loadLocalSettings();
}

/**
 * pg hands back NUMERIC and BIGINT as strings, because either can exceed what a
 * JS number holds exactly. Left alone, every money column would reach the API
 * as "120.00" instead of 120 and every arithmetic on it would concatenate.
 *
 * Both are safe to narrow here: the widest money column is NUMERIC(10,2) and
 * order ids are generated from a timestamp, so neither approaches 2^53.
 */
pgTypes.setTypeParser(pgTypes.builtins.NUMERIC, (value) => parseFloat(value));
pgTypes.setTypeParser(pgTypes.builtins.INT8, (value) => parseInt(value, 10));

/**
 * DATE is kept as the raw 'YYYY-MM-DD' string rather than pg's default of a JS
 * Date at *local* midnight. Every order_date in this app is a business day in
 * IST; parsing it into a local Date and serialising it back through JSON
 * shifts it to the previous day for anyone behind UTC.
 */
pgTypes.setTypeParser(pgTypes.builtins.DATE, (value) => value);

function numFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const CONNECT_TIMEOUT_MS = numFromEnv('DB_CONNECT_TIMEOUT_MS', 15_000);
const STATEMENT_TIMEOUT_MS = numFromEnv('DB_STATEMENT_TIMEOUT_MS', 20_000);

/**
 * Postgres SQLSTATE classes worth a retry rather than a 500: connection
 * exceptions (08xxx), operator intervention such as a restart or an
 * administrator dropping the backend (57Pxx), and deadlock (40P01).
 */
const TRANSIENT_SQL_STATES = new Set([
  '08000', '08003', '08006', '08001', '08004', '08007', '08P01',
  '57P01', '57P02', '57P03', '57P05',
  '40001', '40P01',
  '53300',
]);

/** Socket-level codes raised when the pooler or the network drops a connection. */
const TRANSIENT_DRIVER_CODES = new Set([
  'ETIMEDOUT',
  'ETIMEOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
]);

/**
 * True when an error is worth retrying rather than surfacing to the user.
 *
 * Supabase's transaction pooler recycles backends aggressively and the Azure
 * Functions host freezes sockets between invocations, so a pool that looks
 * healthy can still hand out a dead connection. Walks `originalError` and
 * `cause` because both pg and Node wrap the underlying socket error.
 */
export function isTransientDbError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: any = err;
  for (let depth = 0; current && depth < 5; depth++) {
    if (seen.has(current)) break;
    seen.add(current);
    if (typeof current.code === 'string') {
      if (TRANSIENT_SQL_STATES.has(current.code)) return true;
      if (TRANSIENT_DRIVER_CODES.has(current.code)) return true;
    }
    current = current.originalError ?? current.cause;
  }
  return false;
}

/**
 * TLS settings for a connection string.
 *
 * Supabase terminates TLS at the pooler with a certificate that is not in
 * Node's default trust store, which is what `sslmode=require` in their own
 * connection strings amounts to; DB_SSL_STRICT=true verifies the chain
 * properly once a CA bundle is available.
 *
 * A local Postgres container is built without SSL support and rejects the
 * negotiation outright, so TLS has to be off for it rather than merely
 * unverified. `sslmode=disable` in the URL forces that for any other host.
 */
function sslConfigFor(connectionString: string): boolean | { rejectUnauthorized: boolean } {
  let host = '';
  try {
    const parsed = new URL(connectionString);
    host = parsed.hostname;
    if (parsed.searchParams.get('sslmode') === 'disable') return false;
  } catch {
    // Fall through to the secure default if the string is not a URL.
  }

  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  if (process.env.DB_SSL_STRICT === 'true') return true;
  return { rejectUnauthorized: false };
}

let pool: Pool | null = null;

function buildPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Database not configured: DATABASE_URL environment variable is not set');
  }

  const created = new Pool({
    connectionString,
    ssl: sslConfigFor(connectionString),
    // The transaction pooler multiplexes, so a large client-side pool buys
    // nothing and just holds pooler slots that other Functions instances need.
    max: numFromEnv('DB_POOL_MAX', 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });

  // Without a listener, an idle client dropped by the pooler becomes an
  // unhandled 'error' event and takes the Functions worker down.
  created.on('error', () => {
    if (pool === created) pool = null;
  });

  return created;
}

/** Returns the process-wide pool, creating it on first use. */
export async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = buildPool();
  }
  return pool;
}

/**
 * Runs a pool operation, retrying once on a transient failure.
 *
 * The first query is what discovers a connection the pooler already closed;
 * discarding the pool and retrying turns that into a slow success, not a 500.
 */
export async function withDbRetry<T>(operation: (pool: Pool) => Promise<T>): Promise<T> {
  try {
    return await operation(await getPool());
  } catch (err) {
    if (!isTransientDbError(err)) throw err;
    await closePool().catch(() => {});
    return operation(await getPool());
  }
}

/**
 * Runs `work` inside a transaction on a single dedicated client.
 *
 * Callers must use the client passed in; issuing a query against the pool
 * instead would take a different connection and fall outside the transaction.
 */
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await (await getPool()).connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Runs a statement and returns its rows, retrying once on a transient failure.
 *
 * The retry makes this unsafe for a statement that must not run twice: a
 * connection can drop after the server commits but before the acknowledgement
 * arrives, and the replay would insert a second row. Reads, UPDATEs and
 * DELETEs here are all idempotent; anything that is not should use
 * {@link queryOnce} or run inside {@link withTransaction}.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return withDbRetry(async (p) => (await p.query<T>(text, params as never[])).rows);
}

/**
 * Runs a statement exactly once, with no retry.
 *
 * For a non-idempotent write that is not already inside a transaction, where
 * a duplicate row is worse than a failed request.
 */
export async function queryOnce<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const p = await getPool();
  return (await p.query<T>(text, params as never[])).rows;
}

export async function closePool(): Promise<void> {
  const existing = pool;
  pool = null;
  if (existing) {
    await existing.end();
  }
}
