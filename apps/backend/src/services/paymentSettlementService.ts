import { query, withTransaction } from '../db/pool.js';
import { formatDate } from '../utils/dateUtils.js';

export interface DailyPaymentSettlement {
  id: number;
  orderDate: string;
  expectedCash: number;
  expectedUpi: number;
  actualCash: number;
  actualUpi: number;
  cashConflict: boolean;
  upiConflict: boolean;
  notes: string | null;
  createdBy: number;
  createdAt: string;
}

export interface SettlementSummary {
  orderDate: string;
  expectedCash: number;
  expectedUpi: number;
  totalOrders: number;
  isSettled: boolean;
  settlement?: DailyPaymentSettlement;
}

const SETTLEMENT_COLUMNS = `id, order_date, expected_cash, expected_upi, actual_cash, actual_upi,
      cash_conflict, upi_conflict, notes, created_by, created_at`;

// NUMERIC and BIGINT columns already arrive as numbers thanks to the type
// parsers in src/db/pool.ts, so nothing here needs parseFloat or Number.
function toSettlement(row: any): DailyPaymentSettlement {
  return {
    id: row.id,
    orderDate: formatDate(row.order_date),
    expectedCash: row.expected_cash,
    expectedUpi: row.expected_upi,
    actualCash: row.actual_cash,
    actualUpi: row.actual_upi,
    cashConflict: row.cash_conflict,
    upiConflict: row.upi_conflict,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getExpectedAmounts(date: string): Promise<{ cash: number; upi: number; totalOrders: number }> {
  const rows = await query<{ total_orders: number; total_cash: number; total_upi: number }>(
    `SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(cash_amount), 0) as total_cash,
      COALESCE(SUM(upi_amount), 0) as total_upi
     FROM orders
     WHERE order_date = $1
     AND payment_method != 'pending'`,
    [date],
  );

  const row = rows[0];
  return {
    totalOrders: row.total_orders,
    cash: row.total_cash,
    upi: row.total_upi,
  };
}

export async function getSettlement(date: string): Promise<DailyPaymentSettlement | null> {
  const rows = await query<any>(
    `SELECT ${SETTLEMENT_COLUMNS}
     FROM daily_payment_settlements
     WHERE order_date = $1`,
    [date],
  );

  if (rows.length === 0) return null;
  return toSettlement(rows[0]);
}

export async function getSettlementSummary(date: string): Promise<SettlementSummary> {
  const expected = await getExpectedAmounts(date);
  const settlement = await getSettlement(date);

  return {
    orderDate: date,
    expectedCash: expected.cash,
    expectedUpi: expected.upi,
    totalOrders: expected.totalOrders,
    isSettled: !!settlement,
    settlement: settlement || undefined,
  };
}

export async function createSettlement(
  date: string,
  actualCash: number,
  actualUpi: number,
  notes: string | null,
  createdBy: number,
): Promise<DailyPaymentSettlement> {
  const expected = await getExpectedAmounts(date);

  const cashConflict = Math.abs(actualCash - expected.cash) > 0.01;
  const upiConflict = Math.abs(actualUpi - expected.upi) > 0.01;

  await withTransaction(async (client) => {
    // Delete existing settlement for this date
    await client.query('DELETE FROM daily_payment_settlements WHERE order_date = $1', [date]);

    await client.query(
      `INSERT INTO daily_payment_settlements (order_date, expected_cash, expected_upi, actual_cash, actual_upi, cash_conflict, upi_conflict, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [date, expected.cash, expected.upi, actualCash, actualUpi, cashConflict, upiConflict, notes, createdBy],
    );
  });

  return (await getSettlement(date))!;
}

export async function listSettlements(startDate: string, endDate: string): Promise<DailyPaymentSettlement[]> {
  const rows = await query<any>(
    `SELECT ${SETTLEMENT_COLUMNS}
     FROM daily_payment_settlements
     WHERE order_date BETWEEN $1 AND $2
     ORDER BY order_date DESC`,
    [startDate, endDate],
  );

  return rows.map(toSettlement);
}
