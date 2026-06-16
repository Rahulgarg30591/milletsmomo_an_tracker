import sql from 'mssql';
import { getPool } from '../db/pool.js';
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

export async function getOrders(date: string) {
  const pool = await getPool();
  const request = pool.request();
  request.input('orderDate', sql.Date, date);

  const ordersResult = await request.query(
    `SELECT id, order_date, time_label, order_type, payment_method, is_completed, total_amount, created_by, created_at, completed_at
     FROM Orders WHERE order_date = @orderDate ORDER BY id DESC`,
  );

  const orders = [];
  for (const order of ordersResult.recordset) {
    const itemsRequest = pool.request();
    itemsRequest.input('orderId', sql.BigInt, order.id);
    const itemsResult = await itemsRequest.query(
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

  return { date, orders };
}

export async function createOrder(
  userId: number,
  data: {
    orderDate: string;
    orderType: string;
    paymentMethod: string;
    items: { menuItemId: number; quantity: number; isHalf: boolean }[];
  },
) {
  const pool = await getPool();
  const id = Date.now();
  const timeLabel = formatTimeLabel(new Date());
  const totalAmount = computeOrderTotal(data.items);

  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const orderRequest = transaction.request();
    orderRequest.input('id', sql.BigInt, id);
    orderRequest.input('orderDate', sql.Date, data.orderDate);
    orderRequest.input('timeLabel', sql.NVarChar, timeLabel);
    orderRequest.input('orderType', sql.NVarChar, data.orderType);
    orderRequest.input('paymentMethod', sql.NVarChar, data.paymentMethod);
    orderRequest.input('totalAmount', sql.Decimal(8, 2), totalAmount);
    orderRequest.input('createdBy', sql.Int, userId);

    await orderRequest.query(
      `INSERT INTO Orders (id, order_date, time_label, order_type, payment_method, is_completed, total_amount, created_by)
       VALUES (@id, @orderDate, @timeLabel, @orderType, @paymentMethod, 0, @totalAmount, @createdBy)`,
    );

    for (const item of data.items) {
      const menuItem = findMenuItem(item.menuItemId);
      const { unitPrice, lineTotal } = computeLineTotal(item.menuItemId, item.quantity, item.isHalf);

      const itemRequest = transaction.request();
      itemRequest.input('orderId', sql.BigInt, id);
      itemRequest.input('menuItemId', sql.Int, item.menuItemId);
      itemRequest.input('itemName', sql.NVarChar, menuItem.displayName);
      itemRequest.input('quantity', sql.Int, item.quantity);
      itemRequest.input('isHalf', sql.Bit, item.isHalf ? 1 : 0);
      itemRequest.input('unitPrice', sql.Decimal(6, 2), unitPrice);
      itemRequest.input('lineTotal', sql.Decimal(8, 2), lineTotal);

      await itemRequest.query(
        `INSERT INTO OrderItems (order_id, menu_item_id, item_name, quantity, is_half, unit_price, line_total)
         VALUES (@orderId, @menuItemId, @itemName, @quantity, @isHalf, @unitPrice, @lineTotal)`,
      );
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return {
    id,
    orderDate: data.orderDate,
    timeLabel,
    orderType: data.orderType,
    paymentMethod: data.paymentMethod,
    isCompleted: false,
    totalAmount,
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
) {
  const pool = await getPool();
  const request = pool.request();
  request.input('id', sql.BigInt, id);

  const check = await request.query(
    'SELECT id, payment_method, is_completed FROM Orders WHERE id = @id',
  );
  if (check.recordset.length === 0) {
    throw Object.assign(new Error('Order not found'), { status: 404 });
  }

  const order = check.recordset[0];
  if (order.is_completed) {
    throw Object.assign(new Error('Order already completed'), { status: 400 });
  }

  if (order.payment_method === 'pending' && !paymentMethod) {
    throw Object.assign(new Error('paymentMethod is required for pending orders'), { status: 400 });
  }

  const updateRequest = pool.request();
  updateRequest.input('id', sql.BigInt, id);

  if (paymentMethod) {
    updateRequest.input('paymentMethod', sql.NVarChar, paymentMethod);
    await updateRequest.query(
      `UPDATE Orders SET is_completed = 1, completed_at = SYSUTCDATETIME(), payment_method = @paymentMethod WHERE id = @id`,
    );
  } else {
    await updateRequest.query(
      `UPDATE Orders SET is_completed = 1, completed_at = SYSUTCDATETIME() WHERE id = @id`,
    );
  }

  return { id, completed: true };
}

export async function deleteOrder(id: number) {
  const pool = await getPool();
  const request = pool.request();
  request.input('id', sql.BigInt, id);

  const check = await request.query('SELECT id FROM Orders WHERE id = @id');
  if (check.recordset.length === 0) {
    throw Object.assign(new Error('Order not found'), { status: 404 });
  }

  await request.query('DELETE FROM Orders WHERE id = @id');
  return { deleted: true, id };
}