import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const TABLES = [
  'Users',
  'MenuItems',
  'Orders',
  'OrderItems',
  'SupplyItems',
  'DailySupplyOrders',
  'DailySupplyOrderItems',
  'SupplyOrderLogs',
  'SupplyVerifications',
  'DailyClosingStock',
  'StaffOperationLogs',
  'ClientActivityLogs',
  'DailyPaymentSettlements',
  'DayExpenses',
];

// Credential material must never be committed to git history, even hashed.
const REDACTED_COLUMNS: Record<string, string[]> = {
  Users: ['pin_hash'],
};

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(row[col])).join(','));
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(REPO_ROOT, 'db-backups', today);
  fs.mkdirSync(outDir, { recursive: true });

  const pool = await getPool();

  for (const table of TABLES) {
    const result = await pool.request().query(`SELECT * FROM ${table};`);
    const redacted = REDACTED_COLUMNS[table] ?? [];
    const columns = Object.keys(result.recordset.columns).filter((col) => !redacted.includes(col));
    const csv = toCsv(columns, result.recordset as Record<string, unknown>[]);
    fs.writeFileSync(path.join(outDir, `${table}.csv`), csv, 'utf-8');
    console.log(`Exported ${result.recordset.length} row(s) from ${table}`);
  }

  await closePool();
  console.log(`Export complete: ${outDir}`);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
