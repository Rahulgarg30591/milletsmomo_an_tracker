import sql from 'mssql';
import { getPool } from '../db/pool.js';
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

export async function getOrders(date: string) {
  const pool = await getPool();
  const request = pool.request();
  request.input('orderDate', sql.Date, date);

  const rows = await request.query(
    `SELECT o.id, o.order_date, o.time_label, o.order_type, o.payment_method, o.is_completed,
            o.total_amount, o.cash_amount, o.upi_amount,
            i.menu_item_id, i.item_name, i.quantity, i.is_half, i.unit_price, i.line_total
     FROM Orders o
     LEFT JOIN OrderItems i ON i.order_id = o.id
     WHERE o.order_date = @orderDate
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

export async function createOrder(
  userId: number,
  data: {
    orderDate: string;
    orderType: string;
    paymentMethod: string;
    cashAmount?: number;
    upiAmount?: number;
    items: { menuItemId: number; quantity: number; isHalf: boolean }[];
  },
) {
  const pool = await getPool();
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
    orderRequest.input('cashAmount', sql.Decimal(8, 2), cashAmount);
    orderRequest.input('upiAmount', sql.Decimal(8, 2), upiAmount);
    orderRequest.input('createdBy', sql.Int, userId);

    await orderRequest.query(
      `INSERT INTO Orders (id, order_date, time_label, order_type, payment_method, is_completed, total_amount, cash_amount, upi_amount, created_by)
       VALUES (@id, @orderDate, @timeLabel, @orderType, @paymentMethod, 0, @totalAmount, @cashAmount, @upiAmount, @createdBy)`,
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
  cashAmount?: number,
  upiAmount?: number,
) {
  const pool = await getPool();
  const request = pool.request();
  request.input('id', sql.BigInt, id);

  const check = await request.query(
    'SELECT id, order_date, payment_method, is_completed, total_amount FROM Orders WHERE id = @id',
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

  const finalPaymentMethod = paymentMethod || order.payment_method;
  const finalCash = paymentMethod === 'cash' ? Number(order.total_amount)
    : paymentMethod === 'upi' ? 0
    : paymentMethod === 'split' ? (cashAmount ?? 0)
    : Number(order.cash_amount ?? 0);
  const finalUpi = paymentMethod === 'upi' ? Number(order.total_amount)
    : paymentMethod === 'cash' ? 0
    : paymentMethod === 'split' ? (upiAmount ?? (Number(order.total_amount) - (cashAmount ?? 0)))
    : Number(order.upi_amount ?? 0);

  const updateRequest = pool.request();
  updateRequest.input('id', sql.BigInt, id);

  if (paymentMethod) {
    updateRequest.input('paymentMethod', sql.NVarChar, paymentMethod);
    let query = `UPDATE Orders SET is_completed = 1, completed_at = SYSUTCDATETIME(), payment_method = @paymentMethod`;
    
    if (paymentMethod === 'split') {
      const total = order.total_amount;
      const cash = cashAmount ?? 0;
      const upi = upiAmount ?? (total - cash);
      updateRequest.input('cashAmount', sql.Decimal(8, 2), cash);
      updateRequest.input('upiAmount', sql.Decimal(8, 2), upi);
      query += `, cash_amount = @cashAmount, upi_amount = @upiAmount`;
    } else if (paymentMethod === 'cash') {
      updateRequest.input('cashAmount', sql.Decimal(8, 2), order.total_amount);
      updateRequest.input('upiAmount', sql.Decimal(8, 2), 0);
      query += `, cash_amount = @cashAmount, upi_amount = @upiAmount`;
    } else if (paymentMethod === 'upi') {
      updateRequest.input('cashAmount', sql.Decimal(8, 2), 0);
      updateRequest.input('upiAmount', sql.Decimal(8, 2), order.total_amount);
      query += `, cash_amount = @cashAmount, upi_amount = @upiAmount`;
    }
    
    query += ` WHERE id = @id`;
    await updateRequest.query(query);
  } else {
    await updateRequest.query(
      `UPDATE Orders SET is_completed = 1, completed_at = SYSUTCDATETIME() WHERE id = @id`,
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
  const pool = await getPool();
  const request = pool.request();
  request.input('id', sql.BigInt, id);

  const check = await request.query('SELECT id, order_date FROM Orders WHERE id = @id');
  if (check.recordset.length === 0) {
    throw Object.assign(new Error('Order not found'), { status: 404 });
  }

  const orderDate = formatDate(check.recordset[0].order_date);
  await request.query('DELETE FROM Orders WHERE id = @id');
  return { deleted: true, id, orderDate };
}

export async function updateOrder(
  id: number,
  data: {
    orderType: string;
    paymentMethod: string;
    cashAmount?: number;
    upiAmount?: number;
    items: { menuItemId: number; quantity: number; isHalf: boolean }[];
  },
) {
  const pool = await getPool();
  const checkRequest = pool.request();
  checkRequest.input('id', sql.BigInt, id);
  const check = await checkRequest.query(
    'SELECT id, order_date, is_completed FROM Orders WHERE id = @id',
  );
  if (check.recordset.length === 0) {
    throw Object.assign(new Error('Order not found'), { status: 404 });
  }
  const existing = check.recordset[0];
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

  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const updateRequest = transaction.request();
    updateRequest.input('id', sql.BigInt, id);
    updateRequest.input('orderType', sql.NVarChar, data.orderType);
    updateRequest.input('paymentMethod', sql.NVarChar, data.paymentMethod);
    updateRequest.input('totalAmount', sql.Decimal(8, 2), totalAmount);
    updateRequest.input('cashAmount', sql.Decimal(8, 2), cashAmount);
    updateRequest.input('upiAmount', sql.Decimal(8, 2), upiAmount);

    await updateRequest.query(
      `UPDATE Orders SET order_type = @orderType, payment_method = @paymentMethod, total_amount = @totalAmount, cash_amount = @cashAmount, upi_amount = @upiAmount WHERE id = @id`,
    );

    const deleteItemsRequest = transaction.request();
    deleteItemsRequest.input('orderId', sql.BigInt, id);
    await deleteItemsRequest.query('DELETE FROM OrderItems WHERE order_id = @orderId');

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
    orderDate,
    orderType: data.orderType,
    paymentMethod: data.paymentMethod,
    isCompleted: false,
    totalAmount,
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