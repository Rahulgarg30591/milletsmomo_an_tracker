import type { PoolClient } from 'pg';
import { bulkValues, query, withTransaction } from '../db/pool.js';
import { formatDate } from '../utils/dateUtils.js';
import { formatTimeLabel } from '../utils/time.js';
import { computeLineTotal, computeOrderTotal } from '../utils/pricing.js';
import { buildMenu } from '../constants/menu.js';

const menu = buildMenu();

function findMenuItem(menuItemId: number) {
  const item = menu.find((m) => m.id === menuItemId);
  if (!item) {
    throw Object.assign(new Error(`Menu item ${menuItemId} not found`), {
      status: 400,
    });
  }
  return item;
}

/**
 * Writes an order's line items as a single multi-row INSERT.
 *
 * One statement per item cost a network round trip each, which is the bulk of
 * the time spent placing an order with more than a couple of lines.
 */
async function insertOrderItems(
  client: PoolClient,
  orderId: number,
  items: { menuItemId: number; quantity: number; isHalf: boolean }[],
): Promise<void> {
  if (items.length === 0) return;

  const { text, params } = bulkValues(
    items.map((item) => {
      const menuItem = findMenuItem(item.menuItemId);
      const { unitPrice, lineTotal } = computeLineTotal(item.menuItemId, item.quantity, item.isHalf);
      return [orderId, item.menuItemId, menuItem.displayName, item.quantity, item.isHalf, unitPrice, lineTotal];
    }),
  );

  await client.query(
    `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, is_half, unit_price, line_total)
     VALUES ${text}`,
    params,
  );
}

export async function getOrders(date: string) {
  const rows = await query<any>(
    `SELECT o.id, o.order_date, o.time_label, o.order_type, o.payment_method, o.is_completed,
            o.total_amount, o.cash_amount, o.upi_amount, o.comment,
            i.menu_item_id, i.item_name, i.quantity, i.is_half, i.unit_price, i.line_total
     FROM orders o
     LEFT JOIN order_items i ON i.order_id = o.id
     WHERE o.order_date = $1
     ORDER BY o.id DESC, i.id`,
    [date],
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

export async function createOrder(
  userId: number,
  data: {
    orderDate: string;
    orderType: string;
    paymentMethod: string;
    cashAmount?: number;
    upiAmount?: number;
    comment?: string | null;
    items: { menuItemId: number; quantity: number; isHalf: boolean }[];
  },
) {
  const id = Date.now();
  const timeLabel = formatTimeLabel(new Date());
  const totalAmount = computeOrderTotal(data.items);

  // Compute cash/upi amounts based on payment method
  let cashAmount = 0;
  let upiAmount = 0;
  if (data.paymentMethod === 'cash') {
    cashAmount = totalAmount;
  } else if (data.paymentMethod === 'upi') {
    upiAmount = totalAmount;
  } else if (data.paymentMethod === 'split') {
    cashAmount = data.cashAmount ?? 0;
    upiAmount = data.upiAmount ?? 0;
  }

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO orders (id, order_date, time_label, order_type, payment_method, is_completed, total_amount, cash_amount, upi_amount, created_by, comment)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, $8, $9, $10)`,
      [
        id,
        data.orderDate,
        timeLabel,
        data.orderType,
        data.paymentMethod,
        totalAmount,
        cashAmount,
        upiAmount,
        userId,
        data.comment ?? null,
      ],
    );

    await insertOrderItems(client, id, data.items);
  });

  return {
    id,
    orderDate: data.orderDate,
    timeLabel,
    orderType: data.orderType,
    paymentMethod: data.paymentMethod,
    isCompleted: false,
    totalAmount,
    comment: data.comment ?? null,
    items: data.items.map((item) => {
      const menuItem = findMenuItem(item.menuItemId);
      const { unitPrice, lineTotal } = computeLineTotal(item.menuItemId, item.quantity, item.isHalf);
      return {
        menuItemId: item.menuItemId,
        itemName: menuItem.displayName,
        quantity: item.quantity,
        isHalf: item.isHalf,
        unitPrice,
        lineTotal,
      };
    }),
  };
}

export async function completeOrder(
  id: number,
  paymentMethod?: string,
  cashAmount?: number,
  upiAmount?: number,
) {
  // cash_amount and upi_amount are selected because the no-paymentMethod
  // branch below reports the amounts already on the order. Leaving them out
  // made that branch read undefined and report a settled order as 0 / 0.
  const check = await query<any>(
    `SELECT id, order_date, payment_method, is_completed, total_amount, cash_amount, upi_amount
     FROM orders WHERE id = $1`,
    [id],
  );
  if (check.length === 0) {
    throw Object.assign(new Error('Order not found'), { status: 404 });
  }

  const order = check[0];
  if (order.is_completed) {
    throw Object.assign(new Error('Order already completed'), { status: 400 });
  }

  if (order.payment_method === 'pending' && !paymentMethod) {
    throw Object.assign(new Error('paymentMethod is required for pending orders'), { status: 400 });
  }

  const finalPaymentMethod = paymentMethod || order.payment_method;
  const finalCash = paymentMethod === 'cash' ? Number(order.total_amount)
    : paymentMethod === 'upi' ? 0
    : paymentMethod === 'split' ? (cashAmount ?? 0)
    : Number(order.cash_amount ?? 0);
  const finalUpi = paymentMethod === 'upi' ? Number(order.total_amount)
    : paymentMethod === 'cash' ? 0
    : paymentMethod === 'split' ? (upiAmount ?? (Number(order.total_amount) - (cashAmount ?? 0)))
    : Number(order.upi_amount ?? 0);

  if (paymentMethod) {
    // $1 is the id and $2 the payment method; any amount columns follow, so the
    // placeholder numbers are assigned in the order the values are pushed.
    const params: unknown[] = [id, paymentMethod];
    let text = `UPDATE orders SET is_completed = TRUE, completed_at = NOW(), payment_method = $2`;

    if (paymentMethod === 'split') {
      const total = order.total_amount;
      const cash = cashAmount ?? 0;
      const upi = upiAmount ?? (total - cash);
      params.push(cash, upi);
      text += `, cash_amount = $3, upi_amount = $4`;
    } else if (paymentMethod === 'cash') {
      params.push(order.total_amount, 0);
      text += `, cash_amount = $3, upi_amount = $4`;
    } else if (paymentMethod === 'upi') {
      params.push(0, order.total_amount);
      text += `, cash_amount = $3, upi_amount = $4`;
    }

    text += ` WHERE id = $1`;
    await query(text, params);
  } else {
    await query(
      `UPDATE orders SET is_completed = TRUE, completed_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  return {
    id,
    completed: true,
    orderDate: formatDate(order.order_date),
    paymentMethod: finalPaymentMethod,
    cashAmount: finalCash,
    upiAmount: finalUpi,
    totalAmount: Number(order.total_amount),
  };
}

export async function deleteOrder(id: number) {
  const check = await query<any>('SELECT id, order_date FROM orders WHERE id = $1', [id]);
  if (check.length === 0) {
    throw Object.assign(new Error('Order not found'), { status: 404 });
  }

  const orderDate = formatDate(check[0].order_date);
  await query('DELETE FROM orders WHERE id = $1', [id]);
  return { deleted: true, id, orderDate };
}

export async function updateOrder(
  id: number,
  data: {
    orderType: string;
    paymentMethod: string;
    cashAmount?: number;
    upiAmount?: number;
    comment?: string | null;
    items: { menuItemId: number; quantity: number; isHalf: boolean }[];
  },
) {
  const check = await query<any>(
    'SELECT id, order_date, is_completed FROM orders WHERE id = $1',
    [id],
  );
  if (check.length === 0) {
    throw Object.assign(new Error('Order not found'), { status: 404 });
  }
  const existing = check[0];
  if (existing.is_completed) {
    throw Object.assign(new Error('Cannot edit a completed order'), { status: 400 });
  }

  const orderDate = formatDate(existing.order_date);
  const totalAmount = computeOrderTotal(data.items);

  let cashAmount = 0;
  let upiAmount = 0;
  if (data.paymentMethod === 'cash') {
    cashAmount = totalAmount;
  } else if (data.paymentMethod === 'upi') {
    upiAmount = totalAmount;
  } else if (data.paymentMethod === 'split') {
    cashAmount = data.cashAmount ?? 0;
    upiAmount = data.upiAmount ?? 0;
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE orders SET order_type = $2, payment_method = $3, total_amount = $4, cash_amount = $5, upi_amount = $6, comment = $7 WHERE id = $1`,
      [id, data.orderType, data.paymentMethod, totalAmount, cashAmount, upiAmount, data.comment ?? null],
    );

    await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);

    await insertOrderItems(client, id, data.items);
  });

  return {
    id,
    orderDate,
    orderType: data.orderType,
    paymentMethod: data.paymentMethod,
    isCompleted: false,
    totalAmount,
    comment: data.comment ?? null,
    cashAmount,
    upiAmount,
    items: data.items.map((item) => {
      const menuItem = findMenuItem(item.menuItemId);
      const { unitPrice, lineTotal } = computeLineTotal(item.menuItemId, item.quantity, item.isHalf);
      return {
        menuItemId: item.menuItemId,
        itemName: menuItem.displayName,
        quantity: item.quantity,
        isHalf: item.isHalf,
        unitPrice,
        lineTotal,
      };
    }),
  };
}
