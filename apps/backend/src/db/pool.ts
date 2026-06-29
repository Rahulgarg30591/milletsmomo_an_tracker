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

const config: sql.config = {
  server: process.env.SQL_SERVER || '',
  database: process.env.SQL_DATABASE || '',
  user: process.env.SQL_USER || '',
  password: process.env.SQL_PASSWORD || '',
  port: parseInt(process.env.SQL_PORT || '1433', 10),
  options: {
    encrypt: process.env.SQL_ENCRYPT !== 'false',
    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true',
    enableArithAbort: true,
    connectTimeout: 5000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!config.server) {
    throw new Error('Database not configured: SQL_SERVER environment variable is not set');
  }
  if (pool && pool.connected) return pool;
  if (pool && pool.connecting) {
    return new Promise<sql.ConnectionPool>((resolve, reject) => {
      pool!.once('connect', resolve);
      pool!.once('error', reject);
    });
  }
  pool = await sql.connect(config);
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}