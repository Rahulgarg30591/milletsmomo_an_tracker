import sql from 'mssql';
import { getPool } from '../db/pool.js';

export interface ExpenseItem {
  id: number;
  description: string;
  amount: number;
}

export interface DayExpenses {
  orderDate: string;
  items: ExpenseItem[];
  totalAmount: number;
}

export async function getDayExpenses(date: string): Promise<DayExpenses> {
  const pool = await getPool();
  const request = pool.request();
  request.input('orderDate', sql.Date, date);
  const result = await request.query(
    `SELECT id, order_date, description, amount
     FROM DayExpenses
     WHERE order_date = @orderDate
     ORDER BY id`,
  );
  const items: ExpenseItem[] = result.recordset.map((row: any) => ({
    id: row.id,
    description: row.description,
    amount: row.amount,
  }));
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  return { orderDate: date, items, totalAmount };
}

export async function saveDayExpenses(
  orderDate: string,
  items: { description: string; amount: number }[],
  userId: number,
): Promise<DayExpenses> {
  const pool = await getPool();
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const delReq = transaction.request();
    delReq.input('orderDate', sql.Date, orderDate);
    await delReq.query(`DELETE FROM DayExpenses WHERE order_date = @orderDate`);

    for (const item of items) {
      const insReq = transaction.request();
      insReq.input('orderDate', sql.Date, orderDate);
      insReq.input('description', sql.NVarChar(200), item.description);
      insReq.input('amount', sql.Decimal(10, 2), item.amount);
      insReq.input('createdBy', sql.Int, userId);
      await insReq.query(
        `INSERT INTO DayExpenses (order_date, description, amount, created_by)
         VALUES (@orderDate, @description, @amount, @createdBy)`,
      );
    }

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
      // Transaction may already be aborted server-side; the original err below is what matters.
    }
    throw err;
  }

  return getDayExpenses(orderDate);
}
