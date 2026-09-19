import { formatDate } from './dateUtils.js';

/**
 * Column list for a joined order-with-items query.
 *
 * Shared so the two callers cannot drift apart: `groupOrderRows` reads every
 * column named here, and a SELECT that omits one silently yields undefined.
 */
export const ORDER_WITH_ITEMS_COLUMNS = `o.id, o.order_date, o.time_label, o.order_type, o.payment_method, o.is_completed,
            o.total_amount, o.cash_amount, o.upi_amount, o.comment,
            i.menu_item_id, i.item_name, i.quantity, i.is_half, i.unit_price, i.line_total`;

/**
 * Folds the flat rows of an order/item LEFT JOIN into nested order objects.
 *
 * Rows must arrive grouped by order id, which the shared ORDER BY guarantees.
 * A row whose `menu_item_id` is null is an order with no items, not an item.
 */
export function groupOrderRows(rows: any[]): any[] {
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
        isCompleted: row.is_completed,
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
        isHalf: row.is_half,
        unitPrice: row.unit_price,
        lineTotal: row.line_total,
      });
    }
  }
  return [...orderMap.values()];
}
