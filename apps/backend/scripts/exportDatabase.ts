import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
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

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(REPO_ROOT, 'db-backups');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${today}.xlsx`);

  const pool = await getPool();
  const workbook = new ExcelJS.Workbook();

  for (const table of TABLES) {
    const result = await pool.request().query(`SELECT * FROM ${table};`);
    const redacted = REDACTED_COLUMNS[table] ?? [];
    const columns = Object.keys(result.recordset.columns).filter((col) => !redacted.includes(col));

    const sheet = workbook.addWorksheet(table);
    sheet.columns = columns.map((col) => ({ header: col, key: col }));

    for (const row of result.recordset as Record<string, unknown>[]) {
      const rowData: Record<string, unknown> = {};
      for (const col of columns) {
        const value = row[col];
        rowData[col] = value instanceof Date ? value.toISOString() : value;
      }
      sheet.addRow(rowData);
    }

    console.log(`Exported ${result.recordset.length} row(s) from ${table}`);
  }

  await workbook.xlsx.writeFile(outFile);
  await closePool();
  console.log(`Export complete: ${outFile}`);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
