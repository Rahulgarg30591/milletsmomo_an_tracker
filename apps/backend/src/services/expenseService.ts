import { query, withTransaction } from '../db/pool.js';

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
  const rows = await query<{ id: number; description: string; amount: number }>(
    `SELECT id, order_date, description, amount
     FROM day_expenses
     WHERE order_date = $1
     ORDER BY id`,
    [date],
  );
  const items: ExpenseItem[] = rows.map((row) => ({
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
  await withTransaction(async (client) => {
    await client.query('DELETE FROM day_expenses WHERE order_date = $1', [orderDate]);

    for (const item of items) {
      await client.query(
        `INSERT INTO day_expenses (order_date, description, amount, created_by)
         VALUES ($1, $2, $3, $4)`,
        [orderDate, item.description, item.amount, userId],
      );
    }
  });

  return getDayExpenses(orderDate);
}
