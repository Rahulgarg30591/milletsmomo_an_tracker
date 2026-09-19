import { query } from '../db/pool.js';
import { ORDER_WITH_ITEMS_COLUMNS, groupOrderRows } from '../utils/orderRows.js';

export async function getSummary(date: string, endDate?: string) {
  const isRange = Boolean(endDate && endDate !== date);
  // A range binds both ends; a single day binds only the one parameter, so the
  // placeholder list has to match what the predicate below actually uses.
  const params = isRange ? [date, endDate] : [date];
  const dateFilter = isRange ? 'BETWEEN $1 AND $2' : '= $1';

  // The two queries are independent, so they are issued together.
  const statsPromise = query<{
    totalorders: number;
    totalrevenue: number;
    pendingamount: number;
    cashtotal: number;
    upitotal: number;
  }>(
    `SELECT
      COUNT(*) AS totalOrders,
      COALESCE(SUM(total_amount), 0) AS totalRevenue,
      COALESCE(SUM(CASE WHEN payment_method = 'pending' THEN total_amount ELSE 0 END), 0) AS pendingAmount,
      COALESCE(SUM(cash_amount), 0) AS cashTotal,
      COALESCE(SUM(upi_amount), 0) AS upiTotal
     FROM orders WHERE order_date ${dateFilter}`,
    params,
  );

  const breakdownPromise = query<{
    item_name: string;
    totalquantity: number;
    totalrevenue: number;
  }>(
    `SELECT oi.item_name, SUM(oi.quantity) AS totalQuantity, SUM(oi.line_total) AS totalRevenue
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.order_date ${dateFilter}
     GROUP BY oi.item_name
     ORDER BY totalQuantity DESC`,
    params,
  );

  const [statsRows, breakdownRows] = await Promise.all([statsPromise, breakdownPromise]);
  const stats = statsRows[0];

  return {
    date,
    endDate: endDate || null,
    totalOrders: stats.totalorders,
    totalRevenue: stats.totalrevenue,
    pendingAmount: stats.pendingamount,
    cashTotal: stats.cashtotal,
    upiTotal: stats.upitotal,
    itemBreakdown: breakdownRows.map((row) => ({
      itemName: row.item_name,
      totalQuantity: row.totalquantity,
      totalRevenue: row.totalrevenue,
    })),
  };
}

export async function getAdminOrders(date: string, endDate?: string) {
  const isRange = Boolean(endDate && endDate !== date);
  const params = isRange ? [date, endDate] : [date];
  const dateFilter = isRange ? 'BETWEEN $1 AND $2' : '= $1';

  const rows = await query<any>(
    `SELECT ${ORDER_WITH_ITEMS_COLUMNS}

     FROM orders o
     LEFT JOIN order_items i ON i.order_id = o.id
     WHERE o.order_date ${dateFilter}
     ORDER BY o.id DESC, i.id`,
    params,
  );

  return { date, orders: groupOrderRows(rows) };
}
