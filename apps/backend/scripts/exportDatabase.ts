import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { getPool, closePool } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const TABLES = [
  'users',
  'menu_items',
  'orders',
  'order_items',
  'supply_items',
  'daily_supply_orders',
  'daily_supply_order_items',
  'supply_order_logs',
  'supply_verifications',
  'daily_closing_stock',
  'staff_operation_logs',
  'client_activity_logs',
  'daily_payment_settlements',
  'day_expenses',
];

// Credential material must never be committed to git history, even hashed.
const REDACTED_COLUMNS: Record<string, string[]> = {
  users: ['pin_hash'],
};

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(REPO_ROOT, 'db-backups');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${today}.xlsx`);

  const pool = await getPool();
  const workbook = new ExcelJS.Workbook();

  for (const table of TABLES) {
    // Table names come from the list above, never from user input.
    const result = await pool.query(`SELECT * FROM ${table};`);
    const redacted = REDACTED_COLUMNS[table] ?? [];
    // pg reports the column list on the result itself, which keeps the sheet
    // headers correct even for a table that returned no rows.
    const columns = result.fields.map((field) => field.name).filter((col) => !redacted.includes(col));

    const sheet = workbook.addWorksheet(table);
    sheet.columns = columns.map((col) => ({ header: col, key: col }));

    for (const row of result.rows as Record<string, unknown>[]) {
      const rowData: Record<string, unknown> = {};
      for (const col of columns) {
        const value = row[col];
        rowData[col] = value instanceof Date ? value.toISOString() : value;
      }
      sheet.addRow(rowData);
    }

    console.log(`Exported ${result.rows.length} row(s) from ${table}`);
  }

  await workbook.xlsx.writeFile(outFile);
  await closePool();
  console.log(`Export complete: ${outFile}`);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
