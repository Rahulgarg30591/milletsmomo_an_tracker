import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { formatDate } from '../utils/dateUtils.js';

export interface SupplyItem {
  id: number;
  name: string;
  category: string;
  unitPrice: number;
  piecesPer: number;
  displayName: string;
}

export interface SupplyOrderItem {
  supplyItemId: number;
  name: string;
  displayName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  piecesPer: number;
}

export interface SupplyOrder {
  id: number;
  orderDate: string;
  totalCost: number;
  createdBy: number;
  createdAt: string;
  items: SupplyOrderItem[];
}

export async function getSupplyItems(): Promise<SupplyItem[]> {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT id, name, category, unit_price, pieces_per, display_name
     FROM SupplyItems WHERE is_active = 1 ORDER BY
     CASE category WHEN 'momo_packet' THEN 1 WHEN 'sauce' THEN 2 WHEN 'dip' THEN 3 END, id`,
  );
  return result.recordset.map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    unitPrice: row.unit_price,
    piecesPer: row.pieces_per,
    displayName: row.display_name,
  }));
}

export async function getSupplyOrder(date: string): Promise<SupplyOrder | null> {
  const pool = await getPool();
  const orderReq = pool.request();
  orderReq.input('orderDate', sql.Date, date);

  const orderResult = await orderReq.query(
    `SELECT id, order_date, total_cost, created_by, created_at
     FROM DailySupplyOrders WHERE order_date = @orderDate`,
  );

  if (orderResult.recordset.length === 0) return null;

  const order = orderResult.recordset[0];

  const itemsReq = pool.request();
  itemsReq.input('orderId', sql.Int, order.id);
  const itemsResult = await itemsReq.query(
    `SELECT doi.quantity, doi.unit_price, doi.line_total, si.id AS supply_item_id, si.name, si.category, si.pieces_per, si.display_name
     FROM DailySupplyOrderItems doi
     JOIN SupplyItems si ON doi.supply_item_id = si.id
     WHERE doi.order_id = @orderId
     ORDER BY CASE si.category WHEN 'momo_packet' THEN 1 WHEN 'sauce' THEN 2 WHEN 'dip' THEN 3 END, si.id`,
  );

  return {
    id: order.id,
    orderDate: formatDate(order.order_date),
    totalCost: order.total_cost,
    createdBy: order.created_by,
    createdAt: order.created_at.toISOString(),
    items: itemsResult.recordset.map((row: any) => ({
      supplyItemId: row.supply_item_id,
      name: row.name,
      displayName: row.display_name,
      category: row.category,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      lineTotal: row.line_total,
      piecesPer: row.pieces_per,
    })),
  };
}

export async function createSupplyOrder(
  orderDate: string,
  items: { supplyItemId: number; quantity: number }[],
  createdBy: number,
  action: 'CREATE' | 'UPDATE' = 'CREATE',
): Promise<SupplyOrder> {
  const pool = await getPool();

  const itemIds = items.map((i) => i.supplyItemId);
  const priceReq = pool.request();
  itemIds.forEach((id, idx) => {
    priceReq.input(`id${idx}`, sql.Int, id);
  });
  const nameReq = pool.request();
  itemIds.forEach((id, idx) => {
    nameReq.input(`id${idx}`, sql.Int, id);
  });
  const nameResult = await nameReq.query(
    `SELECT id, display_name FROM SupplyItems WHERE id IN (${itemIds.map((_, idx) => `@id${idx}`).join(', ')})`,
  );
  const nameMap = new Map<number, string>();
  for (const row of nameResult.recordset) {
    nameMap.set(row.id, row.display_name);
  }

  const priceResult = await priceReq.query(
    `SELECT id, unit_price FROM SupplyItems WHERE id IN (${itemIds.map((_, idx) => `@id${idx}`).join(', ')})`,
  );

  const priceMap = new Map<number, number>();
  for (const row of priceResult.recordset) {
    priceMap.set(row.id, row.unit_price);
  }

  for (const item of items) {
    if (!priceMap.has(item.supplyItemId)) {
      throw Object.assign(new Error(`Supply item ${item.supplyItemId} not found`), { status: 400 });
    }
  }

  const totalCost = items.reduce((sum, item) => {
    return sum + priceMap.get(item.supplyItemId)! * item.quantity;
  }, 0);

  const itemSummary = items.map((i) => `${nameMap.get(i.supplyItemId)}: ${i.quantity}`).join(', ');

  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const orderReq = transaction.request();
    orderReq.input('orderDate', sql.Date, orderDate);
    orderReq.input('totalCost', sql.Decimal(10, 2), totalCost);
    orderReq.input('createdBy', sql.Int, createdBy);

    const orderResult = await orderReq.query(
      `INSERT INTO DailySupplyOrders (order_date, total_cost, created_by)
       VALUES (@orderDate, @totalCost, @createdBy);
       SELECT SCOPE_IDENTITY() AS id;`,
    );

    const orderId = orderResult.recordset[0].id;

    for (const item of items) {
      const unitPrice = priceMap.get(item.supplyItemId)!;
      const lineTotal = unitPrice * item.quantity;
      const itemReq = transaction.request();
      itemReq.input('orderId', sql.Int, orderId);
      itemReq.input('supplyItemId', sql.Int, item.supplyItemId);
      itemReq.input('quantity', sql.Int, item.quantity);
      itemReq.input('unitPrice', sql.Decimal(8, 2), unitPrice);
      itemReq.input('lineTotal', sql.Decimal(10, 2), lineTotal);
      await itemReq.query(
        `INSERT INTO DailySupplyOrderItems (order_id, supply_item_id, quantity, unit_price, line_total)
         VALUES (@orderId, @supplyItemId, @quantity, @unitPrice, @lineTotal)`,
      );
    }

    const logReq = transaction.request();
    logReq.input('orderDate', sql.Date, orderDate);
    logReq.input('action', sql.NVarChar(10), action);
    logReq.input('createdBy', sql.Int, createdBy);
    logReq.input('itemSummary', sql.NVarChar(500), itemSummary);
    await logReq.query(
      `INSERT INTO SupplyOrderLogs (order_date, action, created_by, item_summary)
       VALUES (@orderDate, @action, @createdBy, @itemSummary)`,
    );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return (await getSupplyOrder(orderDate))!;
}

export async function updateSupplyOrder(
  date: string,
  items: { supplyItemId: number; quantity: number }[],
  createdBy: number,
): Promise<SupplyOrder> {
  const pool = await getPool();
  const checkReq = pool.request();
  checkReq.input('orderDate', sql.Date, date);
  const existing = await checkReq.query(
    `SELECT id FROM DailySupplyOrders WHERE order_date = @orderDate`,
  );

  if (existing.recordset.length > 0) {
    const deleteReq = pool.request();
    deleteReq.input('orderDate', sql.Date, date);
    await deleteReq.query(
      `DELETE FROM DailySupplyOrderItems WHERE order_id IN (SELECT id FROM DailySupplyOrders WHERE order_date = @orderDate);
       DELETE FROM DailySupplyOrders WHERE order_date = @orderDate;
       DELETE FROM SupplyVerifications WHERE order_date = @orderDate;`,
    );
  }

  return createSupplyOrder(date, items, createdBy, 'UPDATE');
}

export async function listSupplyOrders(startDate: string, endDate: string): Promise<SupplyOrder[]> {
  const pool = await getPool();
  const req = pool.request();
  req.input('startDate', sql.Date, startDate);
  req.input('endDate', sql.Date, endDate);

  const ordersResult = await req.query(
    `SELECT id, order_date, total_cost, created_by, created_at
     FROM DailySupplyOrders
     WHERE order_date BETWEEN @startDate AND @endDate
     ORDER BY order_date DESC`,
  );

  const orders: SupplyOrder[] = [];
  for (const order of ordersResult.recordset) {
    const itemsReq = pool.request();
    itemsReq.input('orderId', sql.Int, order.id);
    const itemsResult = await itemsReq.query(
      `SELECT doi.quantity, doi.unit_price, doi.line_total, si.id AS supply_item_id, si.name, si.category, si.pieces_per, si.display_name
       FROM DailySupplyOrderItems doi
       JOIN SupplyItems si ON doi.supply_item_id = si.id
       WHERE doi.order_id = @orderId
       ORDER BY CASE si.category WHEN 'momo_packet' THEN 1 WHEN 'sauce' THEN 2 WHEN 'dip' THEN 3 END, si.id`,
    );

    orders.push({
      id: order.id,
      orderDate: formatDate(order.order_date),
      totalCost: order.total_cost,
      createdBy: order.created_by,
      createdAt: order.created_at.toISOString(),
      items: itemsResult.recordset.map((row: any) => ({
        supplyItemId: row.supply_item_id,
        name: row.name,
        displayName: row.display_name,
        category: row.category,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        lineTotal: row.line_total,
        piecesPer: row.pieces_per,
      })),
    });
  }

  return orders;
}

export interface SupplyOrderLog {
  id: number;
  orderDate: string;
  action: 'CREATE' | 'UPDATE';
  createdBy: number;
  createdAt: string;
  itemSummary: string;
  displayName: string;
}

export async function getSupplyOrderLogs(date: string): Promise<SupplyOrderLog[]> {
  const pool = await getPool();
  const req = pool.request();
  req.input('orderDate', sql.Date, date);

  const result = await req.query(
    `SELECT l.id, l.order_date, l.action, l.created_by, l.created_at, l.item_summary, u.display_name
     FROM SupplyOrderLogs l
     JOIN Users u ON l.created_by = u.id
     WHERE l.order_date = @orderDate
     ORDER BY l.created_at DESC`,
  );

  return result.recordset.map((row: any) => ({
    id: row.id,
    orderDate: formatDate(row.order_date),
    action: row.action,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    itemSummary: row.item_summary,
    displayName: row.display_name,
  }));
}