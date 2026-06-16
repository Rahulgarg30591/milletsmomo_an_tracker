import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadLocalSettings() {
  if (process.env.SQL_SERVER) return;
  const settingsPath = path.resolve(__dirname, '../../local.settings.json');
  if (!fs.existsSync(settingsPath)) return;
  const raw = fs.readFileSync(settingsPath, 'utf-8');
  const values = JSON.parse(raw).Values || {};
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key] && typeof value === 'string') {
      process.env[key] = value;
    }
  }
}

loadLocalSettings();

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
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
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