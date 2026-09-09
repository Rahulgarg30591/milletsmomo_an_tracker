import sql from 'mssql';
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
  if (process.env.SQL_SERVER) return;
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

function numFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Azure SQL serverless/free tier auto-pauses when idle and a resume takes tens
 * of seconds, so the connect budget must be far larger than a normal TCP dial.
 *
 * The ceiling is Azure Static Web Apps, which cuts an HTTP response off at 45s.
 * `withDbRetry` may connect twice in one request, so these are sized so that
 * worst case stays under that. Waits longer than one request can cover are
 * absorbed by the client retrying (see `apps/frontend/src/api/authApi.ts`).
 */
const CONNECT_TIMEOUT_MS = numFromEnv('SQL_CONNECT_TIMEOUT_MS', 20_000);
const REQUEST_TIMEOUT_MS = numFromEnv('SQL_REQUEST_TIMEOUT_MS', 20_000);

const config: sql.config = {
  server: process.env.SQL_SERVER || '',
  database: process.env.SQL_DATABASE || '',
  user: process.env.SQL_USER || '',
  password: process.env.SQL_PASSWORD || '',
  port: parseInt(process.env.SQL_PORT || '1433', 10),
  requestTimeout: REQUEST_TIMEOUT_MS,
  options: {
    encrypt: process.env.SQL_ENCRYPT !== 'false',
    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true',
    enableArithAbort: true,
    // Takes precedence over config.connectionTimeout in mssql v11.
    connectTimeout: CONNECT_TIMEOUT_MS,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 60_000,
    acquireTimeoutMillis: CONNECT_TIMEOUT_MS,
  },
};

/** Azure SQL error numbers documented as transient/retryable. */
const TRANSIENT_SQL_NUMBERS = new Set([
  4060, 40197, 40501, 40613, 49918, 49919, 49920, 10928, 10929, 11001, 1205, 233, 121, 64, 20,
]);

/** tedious/mssql driver-level codes raised for dropped or timed-out sockets. */
const TRANSIENT_DRIVER_CODES = new Set([
  'ETIMEOUT',
  'ETIMEDOUT',
  'ESOCKET',
  'ECONNCLOSED',
  'ECONNRESET',
  'ENOTOPEN',
  'EPOOLCLOSED',
  'ELOGIN',
]);

/**
 * True when an error is worth retrying rather than surfacing to the user.
 *
 * Covers the Azure SQL serverless resume window (the database rejects or drops
 * connections while it wakes) and sockets frozen by the Functions host between
 * invocations. Walks `originalError` because mssql wraps driver errors.
 */
export function isTransientDbError(err: unknown): boolean {
  let current: any = err;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current.number === 'number' && TRANSIENT_SQL_NUMBERS.has(current.number)) {
      return true;
    }
    if (typeof current.code === 'string' && TRANSIENT_DRIVER_CODES.has(current.code)) {
      return true;
    }
    current = current.originalError;
  }
  return false;
}

let pool: sql.ConnectionPool | null = null;
let connecting: Promise<sql.ConnectionPool> | null = null;

async function openPool(): Promise<sql.ConnectionPool> {
  const candidate = new sql.ConnectionPool(config);
  // Without a listener, a dropped socket becomes an unhandled 'error' event.
  candidate.on('error', () => {
    if (pool === candidate) pool = null;
  });

  try {
    await candidate.connect();
    return candidate;
  } catch (err) {
    await candidate.close().catch(() => {});
    throw err;
  }
}

/**
 * Returns a connected pool, opening one on first use.
 *
 * Concurrent callers share a single in-flight connect so a cold Functions
 * instance cannot open a burst of connections against a waking database.
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (!config.server) {
    throw new Error('Database not configured: SQL_SERVER environment variable is not set');
  }
  if (pool && pool.connected) {
    return pool;
  }
  if (connecting) {
    return connecting;
  }

  const attempt = openPool().then(
    (opened) => {
      pool = opened;
      connecting = null;
      return opened;
    },
    (err) => {
      pool = null;
      connecting = null;
      throw err;
    },
  );

  connecting = attempt;
  return attempt;
}

/**
 * Runs a pool operation, retrying once on a transient failure.
 *
 * A pool that looks connected can still hold a socket the Functions host froze
 * and the network dropped; the first query is what discovers it. Resetting the
 * pool and retrying turns that into a slow success instead of a 500.
 */
export async function withDbRetry<T>(
  operation: (pool: sql.ConnectionPool) => Promise<T>,
): Promise<T> {
  try {
    return await operation(await getPool());
  } catch (err) {
    if (!isTransientDbError(err)) throw err;
    await closePool().catch(() => {});
    return operation(await getPool());
  }
}

export async function closePool(): Promise<void> {
  const existing = pool;
  pool = null;
  connecting = null;
  if (existing) {
    await existing.close();
  }
}
