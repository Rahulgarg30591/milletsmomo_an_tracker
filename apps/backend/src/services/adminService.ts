import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { formatDate } from '../utils/dateUtils.js';

export async function getSummary(date: string, endDate?: string) {
  const pool = await getPool();
  const isRange = endDate && endDate !== date;

  const statsRequest = pool.request();
  statsRequest.input('orderDate', sql.Date, date);
  if (isRange) statsRequest.input('endDate', sql.Date, endDate);

  const statsResult = await statsRequest.query(
    `SELECT
      COUNT(*) AS totalOrders,
      ISNULL(SUM(total_amount), 0) AS totalRevenue,
      ISNULL(SUM(CASE WHEN payment_method = 'pending' THEN total_amount ELSE 0 END), 0) AS pendingAmount,
      ISNULL(SUM(cash_amount), 0) AS cashTotal,
      ISNULL(SUM(upi_amount), 0) AS upiTotal
     FROM Orders WHERE order_date ${isRange ? 'BETWEEN @orderDate AND @endDate' : '= @orderDate'}`,
  );

  const breakdownRequest = pool.request();
  breakdownRequest.input('orderDate', sql.Date, date);
  if (isRange) breakdownRequest.input('endDate', sql.Date, endDate);

  const breakdownResult = await breakdownRequest.query(
    `SELECT oi.item_name, SUM(oi.quantity) AS totalQuantity, SUM(oi.line_total) AS totalRevenue
     FROM OrderItems oi
     JOIN Orders o ON oi.order_id = o.id
     WHERE o.order_date ${isRange ? 'BETWEEN @orderDate AND @endDate' : '= @orderDate'}
     GROUP BY oi.item_name
     ORDER BY totalQuantity DESC`,
  );

  const stats = statsResult.recordset[0];

  return {
    date,
    endDate: endDate || null,
    totalOrders: stats.totalOrders,
    totalRevenue: stats.totalRevenue,
    pendingAmount: stats.pendingAmount,
    cashTotal: stats.cashTotal,
    upiTotal: stats.upiTotal,
    itemBreakdown: breakdownResult.recordset.map((row: any) => ({
      itemName: row.item_name,
      totalQuantity: row.totalQuantity,
      totalRevenue: row.totalRevenue,
    })),
  };
}

export async function getAdminOrders(date: string, endDate?: string) {
  const pool = await getPool();
  const isRange = endDate && endDate !== date;
  const request = pool.request();
  request.input('orderDate', sql.Date, date);
  if (isRange) request.input('endDate', sql.Date, endDate);

  const rows = await request.query(
    `SELECT o.id, o.order_date, o.time_label, o.order_type, o.payment_method, o.is_completed,
            o.total_amount, o.cash_amount, o.upi_amount,
            i.menu_item_id, i.item_name, i.quantity, i.is_half, i.unit_price, i.line_total
     FROM Orders o
     LEFT JOIN OrderItems i ON i.order_id = o.id
     WHERE o.order_date ${isRange ? 'BETWEEN @orderDate AND @endDate' : '= @orderDate'}
     ORDER BY o.id DESC, i.id`,
  );

  const orderMap = new Map<number, any>();
  for (const row of rows.recordset) {
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
