import { query } from '../db/pool.js';

export interface ClosingCash {
  orderDate: string;
  amount: number | null;
  recordedByName: string | null;
  recordedAt: string | null;
}

/** Admin view: what staff counted against what the day's records expect. */
export interface ClosingCashReview extends ClosingCash {
  cashSales: number;
  expenses: number;
  /** Cash sales less expenses paid from the drawer. */
  expectedCash: number;
  /** Collected minus expected; null until staff records the amount. */
  difference: number | null;
}

/** The cash staff recorded for a day, or nulls when none yet. */
export async function getClosingCash(date: string): Promise<ClosingCash> {
  const rows = await query<{ amount: number; display_name: string; recorded_at: Date }>(
    `SELECT c.amount, u.display_name, c.recorded_at
     FROM daily_closing_cash c JOIN users u ON u.id = c.recorded_by
     WHERE c.order_date = $1`,
    [date],
  );
  const row = rows[0];
  return {
    orderDate: date,
    amount: row ? row.amount : null,
    recordedByName: row ? row.display_name : null,
    recordedAt: row ? new Date(row.recorded_at).toISOString() : null,
  };
}

/** Records (or replaces) the cash counted at close. */
export async function saveClosingCash(date: string, amount: number, userId: number): Promise<ClosingCash> {
  await query(
    `INSERT INTO daily_closing_cash (order_date, amount, recorded_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (order_date) DO UPDATE
       SET amount = EXCLUDED.amount, recorded_by = EXCLUDED.recorded_by, recorded_at = NOW()`,
    [date, amount, userId],
  );
  return getClosingCash(date);
}

/** Closing cash with the expected figure and the difference, for admin. */
export async function getClosingCashReview(date: string): Promise<ClosingCashReview> {
  const [cash, sales, expenses] = await Promise.all([
    getClosingCash(date),
    query<{ total: number }>('SELECT COALESCE(SUM(cash_amount), 0) AS total FROM orders WHERE order_date = $1', [date]),
    query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) AS total FROM day_expenses WHERE order_date = $1', [date]),
  ]);
  const cashSales = Number(sales[0].total);
  const expenseTotal = Number(expenses[0].total);
  const expectedCash = Math.round((cashSales - expenseTotal) * 100) / 100;
  return {
    ...cash,
    cashSales,
    expenses: expenseTotal,
    expectedCash,
    difference: cash.amount === null ? null : Math.round((cash.amount - expectedCash) * 100) / 100,
  };
}
