import sql from 'mssql';
import '../src/db/pool.js';

const env = process.env.NODE_ENV || 'development';
const isDev = env !== 'production';

const dbName = process.env.SQL_DATABASE || 'millets-momo-db';

const masterConfig: sql.config = {
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
};

async function createDatabase() {
  console.log(`Connecting to master on ${masterConfig.server}...`);
  const pool = await sql.connect(masterConfig);
  console.log(`Creating database "${dbName}" if not exists...`);
  await pool.request().query(`IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '${dbName}') CREATE DATABASE [${dbName}]`);
  console.log(`Database "${dbName}" ready.`);
  await pool.close();
}

createDatabase().catch((err) => {
  console.error('Failed to create database:', err.message);
  process.exit(1);
});