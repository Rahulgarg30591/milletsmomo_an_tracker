import sql from 'mssql';
import { getPool } from '../db/pool.js';

export async function getSummary(date: string) {
  const pool = await getPool();

  const statsRequest = pool.request();
  statsRequest.input('orderDate', sql.Date, date);

  const statsResult = await statsRequest.query(
    `SELECT
      COUNT(*) AS totalOrders,
      ISNULL(SUM(total_amount), 0) AS totalRevenue,
      ISNULL(SUM(CASE WHEN payment_method = 'pending' THEN total_amount ELSE 0 END), 0) AS pendingAmount,
      ISNULL(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) AS cashTotal,
      ISNULL(SUM(CASE WHEN payment_method = 'upi' THEN total_amount ELSE 0 END), 0) AS upiTotal
     FROM Orders WHERE order_date = @orderDate`,
  );

  const breakdownRequest = pool.request();
  breakdownRequest.input('orderDate', sql.Date, date);

  const breakdownResult = await breakdownRequest.query(
    `SELECT oi.item_name, SUM(oi.quantity) AS totalQuantity, SUM(oi.line_total) AS totalRevenue
     FROM OrderItems oi
     JOIN Orders o ON oi.order_id = o.id
     WHERE o.order_date = @orderDate
     GROUP BY oi.item_name
     ORDER BY totalQuantity DESC`,
  );

  const ordersRequest = pool.request();
  ordersRequest.input('orderDate', sql.Date, date);

  const ordersResult = await ordersRequest.query(
    `SELECT id, order_date, time_label, order_type, payment_method, is_completed, total_amount
     FROM Orders WHERE order_date = @orderDate ORDER BY id DESC`,
  );

  const orders = [];
  for (const order of ordersResult.recordset) {
    const itemsReq = pool.request();
    itemsReq.input('orderId', sql.BigInt, order.id);
    const itemsResult = await itemsReq.query(
      `SELECT menu_item_id, item_name, quantity, is_half, unit_price, line_total
       FROM OrderItems WHERE order_id = @orderId`,
    );
    orders.push({
      id: order.id,
      orderDate: order.order_date.toISOString().slice(0, 10),
      timeLabel: order.time_label,
      orderType: order.order_type,
      paymentMethod: order.payment_method,
      isCompleted: !!order.is_completed,
      totalAmount: order.total_amount,
      items: itemsResult.recordset.map((item: any) => ({
        menuItemId: item.menu_item_id,
        itemName: item.item_name,
        quantity: item.quantity,
        isHalf: !!item.is_half,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
      })),
    });
  }

  const stats = statsResult.recordset[0];

  return {
    date,
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
    orders,
  };
}