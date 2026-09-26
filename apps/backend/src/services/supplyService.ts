import type { PoolClient } from 'pg';
import { bulkValues, query, withTransaction } from '../db/pool.js';
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

const CATEGORY_ORDER = `CASE si.category WHEN 'momo_packet' THEN 1 WHEN 'sauce' THEN 2 WHEN 'dip' THEN 3 END, si.id`;

export async function getSupplyItems(): Promise<SupplyItem[]> {
  const rows = await query<any>(
    `SELECT id, name, category, unit_price, pieces_per, display_name
     FROM supply_items WHERE is_active = TRUE ORDER BY
     CASE category WHEN 'momo_packet' THEN 1 WHEN 'sauce' THEN 2 WHEN 'dip' THEN 3 END, id`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    unitPrice: row.unit_price,
    piecesPer: row.pieces_per,
    displayName: row.display_name,
  }));
}

function toOrderItem(row: any): SupplyOrderItem {
  return {
    supplyItemId: row.supply_item_id,
    name: row.name,
    displayName: row.display_name,
    category: row.category,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
    piecesPer: row.pieces_per,
  };
}

/**
 * Loads the items for several supply orders in one query.
 *
 * Fetching them one order at a time costs a round trip per order — about 30ms
 * each against the Supabase pooler — so a three-month listing spent seconds
 * waiting on the network rather than on the database.
 *
 * @returns Items keyed by order id, each list already in category order.
 */
async function getOrderItemsByOrder(orderIds: number[]): Promise<Map<number, SupplyOrderItem[]>> {
  const byOrder = new Map<number, SupplyOrderItem[]>();
  for (const id of orderIds) byOrder.set(id, []);
  if (orderIds.length === 0) return byOrder;

  const rows = await query<any>(
    `SELECT doi.order_id, doi.quantity, doi.unit_price, doi.line_total,
            si.id AS supply_item_id, si.name, si.category, si.pieces_per, si.display_name
     FROM daily_supply_order_items doi
     JOIN supply_items si ON doi.supply_item_id = si.id
     WHERE doi.order_id = ANY($1::int[])
     ORDER BY doi.order_id, ${CATEGORY_ORDER}`,
    [orderIds],
  );

  for (const row of rows) {
    byOrder.get(row.order_id)!.push(toOrderItem(row));
  }
  return byOrder;
}

async function getOrderItems(orderId: number): Promise<SupplyOrderItem[]> {
  return (await getOrderItemsByOrder([orderId])).get(orderId)!;
}

export async function getSupplyOrder(date: string): Promise<SupplyOrder | null> {
  const orderRows = await query<any>(
    `SELECT id, order_date, total_cost, created_by, created_at
     FROM daily_supply_orders WHERE order_date = $1`,
    [date],
  );

  if (orderRows.length === 0) return null;

  const order = orderRows[0];

  return {
    id: order.id,
    orderDate: formatDate(order.order_date),
    totalCost: order.total_cost,
    createdBy: order.created_by,
    createdAt: order.created_at.toISOString(),
    items: await getOrderItems(order.id),
  };
}

export async function createSupplyOrder(
  orderDate: string,
  items: { supplyItemId: number; quantity: number }[],
  createdBy: number,
  action: 'CREATE' | 'UPDATE' = 'CREATE',
): Promise<SupplyOrder> {
  const itemIds = items.map((i) => i.supplyItemId);

  // Postgres takes the whole id list as one array parameter, so this no longer
  // needs a placeholder built per id — and name and price come back together
  // rather than in two separate round trips.
  const lookupRows = await query<{ id: number; display_name: string; unit_price: number }>(
    `SELECT id, display_name, unit_price FROM supply_items WHERE id = ANY($1::int[])`,
    [itemIds],
  );

  const nameMap = new Map<number, string>();
  const priceMap = new Map<number, number>();
  for (const row of lookupRows) {
    nameMap.set(row.id, row.display_name);
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

  await withTransaction(async (client) => {
    // RETURNING replaces SCOPE_IDENTITY(): it hands back the generated id from
    // the insert itself, with no second statement and no session state.
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO daily_supply_orders (order_date, total_cost, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [orderDate, totalCost, createdBy],
    );

    const orderId = inserted.rows[0].id;

    // One statement for all items: a round trip per row costs ~30ms each.
    const { text, params } = bulkValues(items.map((item) => {
      const unitPrice = priceMap.get(item.supplyItemId)!;
      return [orderId, item.supplyItemId, item.quantity, unitPrice, unitPrice * item.quantity];
    }));
    await client.query(
      `INSERT INTO daily_supply_order_items (order_id, supply_item_id, quantity, unit_price, line_total)
       VALUES ${text}`,
      params,
    );

    await client.query(
      `INSERT INTO supply_order_logs (order_date, action, created_by, item_summary)
       VALUES ($1, $2, $3, $4)`,
      [orderDate, action, createdBy, itemSummary],
    );
  });

  return (await getSupplyOrder(orderDate))!;
}

export async function updateSupplyOrder(
  date: string,
  items: { supplyItemId: number; quantity: number }[],
  createdBy: number,
): Promise<SupplyOrder> {
  const existing = await query<{ id: number }>(
    `SELECT id FROM daily_supply_orders WHERE order_date = $1`,
    [date],
  );

  if (existing.length > 0) {
    // A transaction keeps the deletes from half-applying and leaving an order
    // without its items.
    await withTransaction((client) => deleteSupplyOrderRows(client, date));
  }

  return createSupplyOrder(date, items, createdBy, 'UPDATE');
}

/** Remove a day's supply order, its items and any verification of it. */
async function deleteSupplyOrderRows(client: PoolClient, date: string): Promise<void> {
  await client.query(
    `DELETE FROM daily_supply_order_items WHERE order_id IN (SELECT id FROM daily_supply_orders WHERE order_date = $1)`,
    [date],
  );
  await client.query('DELETE FROM daily_supply_orders WHERE order_date = $1', [date]);
  await client.query('DELETE FROM supply_verifications WHERE order_date = $1', [date]);
}

/**
 * Whether a date is marked "No Supply Today".
 *
 * Only the latest supply_order log counts, and only while no supply order
 * exists: an order placed after the mark supersedes it, and a mark placed
 * after an order cancels that order.
 */
export async function isMarkedNoSupply(date: string): Promise<boolean> {
  const orderRows = await query<{ id: number }>(
    `SELECT id FROM daily_supply_orders WHERE order_date = $1`,
    [date],
  );
  if (orderRows.length > 0) return false;

  const logRows = await query<{ metadata: string | null }>(
    `SELECT metadata FROM staff_operation_logs
     WHERE order_date = $1 AND operation_type = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [date, 'supply_order'],
  );
  if (logRows.length === 0 || !logRows[0].metadata) return false;
  try {
    return JSON.parse(logRows[0].metadata)?.noSupply === true;
  } catch {
    return false;
  }
}

/**
 * Mark a date "No Supply Today", cancelling any supply order placed for it
 * (the supply never arrived). The order, its items and its verification are
 * deleted and the mark is logged in one transaction, so supply for the day
 * counts as zero everywhere: live stock, closing stock and the minimum sale
 * value all fall back to yesterday's leftovers.
 *
 * @returns the cancelled order, or null if none existed.
 */
export async function markNoSupply(date: string, markedBy: number): Promise<SupplyOrder | null> {
  const cancelled = await getSupplyOrder(date);

  const details = cancelled
    ? `Marked as No Supply Today (cancelled supply order of ₹${Number(cancelled.totalCost).toFixed(2)})`
    : 'Marked as No Supply Today';
  const metadata = {
    noSupply: true,
    orderDate: date,
    ...(cancelled && {
      cancelledOrder: {
        supplyOrderId: cancelled.id,
        totalCost: Number(cancelled.totalCost),
        items: cancelled.items.map((i) => ({ supplyItemId: i.supplyItemId, quantity: i.quantity })),
      },
    }),
  };

  await withTransaction(async (client) => {
    await deleteSupplyOrderRows(client, date);
    await client.query(
      `INSERT INTO staff_operation_logs (order_date, operation_type, created_by, details, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [date, 'supply_order', markedBy, details, JSON.stringify(metadata)],
    );
  });

  return cancelled;
}

export async function listSupplyOrders(startDate: string, endDate: string): Promise<SupplyOrder[]> {
  const orderRows = await query<any>(
    `SELECT id, order_date, total_cost, created_by, created_at
     FROM daily_supply_orders
     WHERE order_date BETWEEN $1 AND $2
     ORDER BY order_date DESC`,
    [startDate, endDate],
  );

  const itemsByOrder = await getOrderItemsByOrder(orderRows.map((o) => o.id));

  return orderRows.map((order) => ({
    id: order.id,
    orderDate: formatDate(order.order_date),
    totalCost: order.total_cost,
    createdBy: order.created_by,
    createdAt: order.created_at.toISOString(),
    items: itemsByOrder.get(order.id) ?? [],
  }));
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
  const rows = await query<any>(
    `SELECT l.id, l.order_date, l.action, l.created_by, l.created_at, l.item_summary, u.display_name
     FROM supply_order_logs l
     JOIN users u ON l.created_by = u.id
     WHERE l.order_date = $1
     ORDER BY l.created_at DESC`,
    [date],
  );

  return rows.map((row) => ({
    id: row.id,
    orderDate: formatDate(row.order_date),
    action: row.action,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    itemSummary: row.item_summary,
    displayName: row.display_name,
  }));
}
