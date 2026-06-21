import sql from 'mssql';
import { getPool } from '../db/pool.js';
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

export async function getExpectedAmounts(date: string): Promise<{ cash: number; upi: number; totalOrders: number }> {
  const pool = await getPool();
  const req = pool.request();
  req.input('orderDate', sql.Date, date);

  const result = await req.query(
    `SELECT 
      COUNT(*) as total_orders,
      ISNULL(SUM(cash_amount), 0) as total_cash,
      ISNULL(SUM(upi_amount), 0) as total_upi
     FROM Orders
     WHERE order_date = @orderDate
     AND payment_method != 'pending'`,
  );

  const row = result.recordset[0];
  return {
    totalOrders: row.total_orders,
    cash: parseFloat(row.total_cash),
    upi: parseFloat(row.total_upi),
  };
}

export async function getSettlement(date: string): Promise<DailyPaymentSettlement | null> {
  const pool = await getPool();
  const req = pool.request();
  req.input('orderDate', sql.Date, date);

  const result = await req.query(
    `SELECT id, order_date, expected_cash, expected_upi, actual_cash, actual_upi,
      cash_conflict, upi_conflict, notes, created_by, created_at
     FROM DailyPaymentSettlements
     WHERE order_date = @orderDate`,
  );

  if (result.recordset.length === 0) return null;

  const row = result.recordset[0];
  return {
    id: row.id,
    orderDate: formatDate(row.order_date),
    expectedCash: parseFloat(row.expected_cash),
    expectedUpi: parseFloat(row.expected_upi),
    actualCash: parseFloat(row.actual_cash),
    actualUpi: parseFloat(row.actual_upi),
    cashConflict: row.cash_conflict,
    upiConflict: row.upi_conflict,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
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

  const pool = await getPool();

  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Delete existing settlement for this date
    const deleteReq = transaction.request();
    deleteReq.input('orderDate', sql.Date, date);
    await deleteReq.query(
      `DELETE FROM DailyPaymentSettlements WHERE order_date = @orderDate`,
    );

    const insertReq = transaction.request();
    insertReq.input('orderDate', sql.Date, date);
    insertReq.input('expectedCash', sql.Decimal(10, 2), expected.cash);
    insertReq.input('expectedUpi', sql.Decimal(10, 2), expected.upi);
    insertReq.input('actualCash', sql.Decimal(10, 2), actualCash);
    insertReq.input('actualUpi', sql.Decimal(10, 2), actualUpi);
    insertReq.input('cashConflict', sql.Bit, cashConflict);
    insertReq.input('upiConflict', sql.Bit, upiConflict);
    insertReq.input('notes', sql.NVarChar(500), notes);
    insertReq.input('createdBy', sql.Int, createdBy);

    await insertReq.query(
      `INSERT INTO DailyPaymentSettlements (order_date, expected_cash, expected_upi, actual_cash, actual_upi, cash_conflict, upi_conflict, notes, created_by)
       VALUES (@orderDate, @expectedCash, @expectedUpi, @actualCash, @actualUpi, @cashConflict, @upiConflict, @notes, @createdBy)`,
    );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return (await getSettlement(date))!;
}

export async function listSettlements(startDate: string, endDate: string): Promise<DailyPaymentSettlement[]> {
  const pool = await getPool();
  const req = pool.request();
  req.input('startDate', sql.Date, startDate);
  req.input('endDate', sql.Date, endDate);

  const result = await req.query(
    `SELECT id, order_date, expected_cash, expected_upi, actual_cash, actual_upi,
      cash_conflict, upi_conflict, notes, created_by, created_at
     FROM DailyPaymentSettlements
     WHERE order_date BETWEEN @startDate AND @endDate
     ORDER BY order_date DESC`,
  );

  return result.recordset.map((row) => ({
    id: row.id,
    orderDate: row.order_date instanceof Date ? formatDate(row.order_date) : row.order_date,
    expectedCash: parseFloat(row.expected_cash),
    expectedUpi: parseFloat(row.expected_upi),
    actualCash: parseFloat(row.actual_cash),
    actualUpi: parseFloat(row.actual_upi),
    cashConflict: row.cash_conflict,
    upiConflict: row.upi_conflict,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  }));
}
