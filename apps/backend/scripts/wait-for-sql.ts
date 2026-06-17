import sql from 'mssql';

const env = process.env.NODE_ENV || 'development';
const isDev = env !== 'production';

const config: sql.config = {
  server: process.env.SQL_SERVER || 'localhost',
  database: 'master',
  user: isDev ? (process.env.SQL_USER || 'sa') : (process.env.SQL_USER || ''),
  password: isDev ? (process.env.SQL_PASSWORD || 'MomoDev2024!') : (process.env.SQL_PASSWORD || ''),
  port: parseInt(process.env.SQL_PORT || '1433', 10),
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true' || isDev,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 3000;

async function waitForSql() {
  console.log(`Waiting for SQL Server at ${config.server}...`);
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const pool = await sql.connect(config);
      await pool.request().query('SELECT 1');
      await pool.close();
      console.log('SQL Server is ready.');
      return;
    } catch {
      console.log(`  Attempt ${i}/${MAX_RETRIES} — not ready, retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw new Error(`SQL Server not available after ${MAX_RETRIES} attempts`);
}

waitForSql().catch((err) => {
  console.error(err.message);
  process.exit(1);
});