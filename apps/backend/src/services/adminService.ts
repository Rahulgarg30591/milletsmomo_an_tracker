import { query } from '../db/pool.js';
import { formatDate } from '../utils/dateUtils.js';

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
    `SELECT o.id, o.order_date, o.time_label, o.order_type, o.payment_method, o.is_completed,
            o.total_amount, o.cash_amount, o.upi_amount, o.comment,
            i.menu_item_id, i.item_name, i.quantity, i.is_half, i.unit_price, i.line_total
     FROM orders o
     LEFT JOIN order_items i ON i.order_id = o.id
     WHERE o.order_date ${dateFilter}
     ORDER BY o.id DESC, i.id`,
    params,
  );

  const orderMap = new Map<number, any>();
  for (const row of rows) {
    let order = orderMap.get(row.id);
    if (!order) {
      order = {
        id: Number(row.id),
        orderDate: formatDate(row.order_date),
        timeLabel: row.time_label,
        orderType: row.order_type,
        paymentMethod: row.payment_method,
        isCompleted: !!row.is_completed,
        totalAmount: row.total_amount,
        cashAmount: row.cash_amount,
        upiAmount: row.upi_amount,
        comment: row.comment ?? null,
        items: [],
      };
      orderMap.set(row.id, order);
    }
    if (row.menu_item_id !== null) {
      order.items.push({
        menuItemId: row.menu_item_id,
        itemName: row.item_name,
        quantity: row.quantity,
        isHalf: !!row.is_half,
        unitPrice: row.unit_price,
        lineTotal: row.line_total,
      });
    }
  }

  return { date, orders: [...orderMap.values()] };
}
