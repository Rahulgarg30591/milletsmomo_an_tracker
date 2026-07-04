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

  const ordersRequest = pool.request();
  ordersRequest.input('orderDate', sql.Date, date);
  if (isRange) ordersRequest.input('endDate', sql.Date, endDate);

  const ordersResult = await ordersRequest.query(
    `SELECT id, order_date, time_label, order_type, payment_method, is_completed, total_amount
     FROM Orders WHERE order_date ${isRange ? 'BETWEEN @orderDate AND @endDate' : '= @orderDate'} ORDER BY id DESC`,
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
      id: Number(order.id),
      orderDate: formatDate(order.order_date),
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
    orders,
  };
}