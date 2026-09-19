import { describe, it, expect } from 'vitest';
import { query } from '../../src/db/pool.js';
import {
  createOrder,
  getOrders,
  completeOrder,
  updateOrder,
  deleteOrder,
} from '../../src/services/ordersService.js';

const DATE = '2026-03-15';
const STAFF = 1;

/** A full plate is six momos; a half plate is three. */
const FULL_PLATE = 6;
const HALF_PLATE = 3;

const VEG_STEAM = 1;      // full 89, half 50
const PANEER_STEAM = 2;   // full 109, half 60
const COLD_DRINK = 29;    // flat 10
const WATER = 30;         // flat 10

async function placeOrder(overrides: Record<string, any> = {}) {
  return createOrder(STAFF, {
    orderDate: DATE,
    orderType: 'dine',
    paymentMethod: 'cash',
    items: [{ menuItemId: VEG_STEAM, quantity: FULL_PLATE, isHalf: false }],
    ...overrides,
  });
}

describe('ordersService against a real database', () => {
  describe('createOrder', () => {
    it('prices a full plate at the menu price', async () => {
      const order = await placeOrder();
      expect(order.totalAmount).toBe(89);
      expect(order.items).toHaveLength(1);
      expect(order.items[0].lineTotal).toBe(89);
    });

    it('prices a half plate at the half price', async () => {
      const order = await placeOrder({
        items: [{ menuItemId: PANEER_STEAM, quantity: HALF_PLATE, isHalf: true }],
      });
      expect(order.totalAmount).toBe(60);
    });

    it('prices beverages flat, per unit', async () => {
      const order = await placeOrder({
        items: [
          { menuItemId: COLD_DRINK, quantity: 2, isHalf: false },
          { menuItemId: WATER, quantity: 1, isHalf: false },
        ],
      });
      expect(order.totalAmount).toBe(30);
    });

    it('charges a part plate per momo on top of whole plates', async () => {
      // 8 momos of Veg Steam: one plate at 89, plus 2 momos at round(50/3)=17.
      const order = await placeOrder({
        items: [{ menuItemId: VEG_STEAM, quantity: 8, isHalf: false }],
      });
      expect(order.totalAmount).toBe(89 + 2 * 17);
    });

    it('persists every line item, not just the first', async () => {
      const order = await placeOrder({
        items: [
          { menuItemId: VEG_STEAM, quantity: FULL_PLATE, isHalf: false },
          { menuItemId: PANEER_STEAM, quantity: HALF_PLATE, isHalf: true },
          { menuItemId: COLD_DRINK, quantity: 1, isHalf: false },
        ],
      });
      const rows = await query<{ n: number }>(
        'SELECT count(*)::int n FROM order_items WHERE order_id = $1',
        [order.id],
      );
      expect(rows[0].n).toBe(3);
      expect(order.totalAmount).toBe(89 + 60 + 10);
    });

    it('splits the amount across cash and UPI as given', async () => {
      const order = await placeOrder({ paymentMethod: 'split', cashAmount: 50, upiAmount: 39 });
      const [row] = await query<any>('SELECT cash_amount, upi_amount FROM orders WHERE id = $1', [order.id]);
      expect(row.cash_amount).toBe(50);
      expect(row.upi_amount).toBe(39);
    });

    it('stores the whole total as cash for a cash order', async () => {
      const order = await placeOrder({ paymentMethod: 'cash' });
      const [row] = await query<any>('SELECT cash_amount, upi_amount FROM orders WHERE id = $1', [order.id]);
      expect(row.cash_amount).toBe(89);
      expect(row.upi_amount).toBe(0);
    });

    it('rejects an unknown menu item and writes nothing', async () => {
      await expect(
        placeOrder({ items: [{ menuItemId: 9999, quantity: FULL_PLATE, isHalf: false }] }),
      ).rejects.toMatchObject({ status: 400 });
      const rows = await query<{ n: number }>('SELECT count(*)::int n FROM orders');
      expect(rows[0].n).toBe(0);
    });

    it('rolls the whole order back when one line is invalid', async () => {
      await expect(
        placeOrder({
          items: [
            { menuItemId: VEG_STEAM, quantity: FULL_PLATE, isHalf: false },
            { menuItemId: 9999, quantity: FULL_PLATE, isHalf: false },
          ],
        }),
      ).rejects.toMatchObject({ status: 400 });
      const orders = await query<{ n: number }>('SELECT count(*)::int n FROM orders');
      const items = await query<{ n: number }>('SELECT count(*)::int n FROM order_items');
      expect(orders[0].n).toBe(0);
      expect(items[0].n).toBe(0);
    });
  });

  describe('getOrders', () => {
    it('returns the day\'s orders newest first, with their items nested', async () => {
      await placeOrder();
      await placeOrder({ items: [{ menuItemId: PANEER_STEAM, quantity: FULL_PLATE, isHalf: false }] });

      const { orders } = await getOrders(DATE);
      expect(orders).toHaveLength(2);
      expect(orders[0].id).toBeGreaterThan(orders[1].id);
      expect(orders[0].items).toHaveLength(1);
    });

    it('returns the date as a plain string, not shifted by a timezone', async () => {
      await placeOrder();
      const { orders } = await getOrders(DATE);
      expect(orders[0].orderDate).toBe(DATE);
    });

    it('hands back numbers and booleans, not strings and 0/1', async () => {
      await placeOrder();
      const [order] = (await getOrders(DATE)).orders;
      expect(typeof order.totalAmount).toBe('number');
      expect(typeof order.isCompleted).toBe('boolean');
      expect(typeof order.items[0].isHalf).toBe('boolean');
    });

    it('ignores orders from other days', async () => {
      await placeOrder();
      await placeOrder({ orderDate: '2026-03-16' });
      expect((await getOrders(DATE)).orders).toHaveLength(1);
    });
  });

  describe('completeOrder', () => {
    it('reports the amounts already on the order when none are supplied', async () => {
      // The regression: the SELECT omitted cash_amount and upi_amount, so this
      // branch reported a settled order as 0 / 0.
      const order = await placeOrder({ paymentMethod: 'cash' });
      const result = await completeOrder(order.id);
      expect(result.cashAmount).toBe(89);
      expect(result.upiAmount).toBe(0);
    });

    it('moves the full total to UPI when completed as UPI', async () => {
      const order = await placeOrder({ paymentMethod: 'pending' });
      const result = await completeOrder(order.id, 'upi');
      expect(result.upiAmount).toBe(89);
      const [row] = await query<any>('SELECT cash_amount, upi_amount FROM orders WHERE id = $1', [order.id]);
      expect(row.upi_amount).toBe(89);
      expect(row.cash_amount).toBe(0);
    });

    it('records the completion timestamp and flag', async () => {
      const order = await placeOrder();
      await completeOrder(order.id);
      const [row] = await query<any>('SELECT is_completed, completed_at FROM orders WHERE id = $1', [order.id]);
      expect(row.is_completed).toBe(true);
      expect(row.completed_at).toBeInstanceOf(Date);
    });

    it('refuses to complete an order twice', async () => {
      const order = await placeOrder();
      await completeOrder(order.id);
      await expect(completeOrder(order.id)).rejects.toMatchObject({ status: 400 });
    });

    it('requires a payment method for a pending order', async () => {
      const order = await placeOrder({ paymentMethod: 'pending' });
      await expect(completeOrder(order.id)).rejects.toMatchObject({ status: 400 });
    });

    it('reports a missing order as 404', async () => {
      await expect(completeOrder(1)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('updateOrder', () => {
    it('replaces the line items rather than adding to them', async () => {
      const order = await placeOrder({
        items: [
          { menuItemId: VEG_STEAM, quantity: FULL_PLATE, isHalf: false },
          { menuItemId: PANEER_STEAM, quantity: FULL_PLATE, isHalf: false },
        ],
      });
      await updateOrder(order.id, {
        orderType: 'pack',
        paymentMethod: 'upi',
        items: [{ menuItemId: COLD_DRINK, quantity: 1, isHalf: false }],
      });
      const rows = await query<{ n: number }>(
        'SELECT count(*)::int n FROM order_items WHERE order_id = $1',
        [order.id],
      );
      expect(rows[0].n).toBe(1);
    });

    it('recomputes the total from the new items', async () => {
      const order = await placeOrder();
      const updated = await updateOrder(order.id, {
        orderType: 'dine',
        paymentMethod: 'cash',
        items: [{ menuItemId: PANEER_STEAM, quantity: HALF_PLATE, isHalf: true }],
      });
      expect(updated.totalAmount).toBe(60);
    });

    it('refuses to edit a completed order', async () => {
      const order = await placeOrder();
      await completeOrder(order.id);
      await expect(
        updateOrder(order.id, {
          orderType: 'dine',
          paymentMethod: 'cash',
          items: [{ menuItemId: VEG_STEAM, quantity: FULL_PLATE, isHalf: false }],
        }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('deleteOrder', () => {
    it('removes the order and its items through the cascade', async () => {
      const order = await placeOrder({
        items: [
          { menuItemId: VEG_STEAM, quantity: FULL_PLATE, isHalf: false },
          { menuItemId: COLD_DRINK, quantity: 1, isHalf: false },
        ],
      });
      await deleteOrder(order.id);
      const orders = await query<{ n: number }>('SELECT count(*)::int n FROM orders');
      const items = await query<{ n: number }>('SELECT count(*)::int n FROM order_items');
      expect(orders[0].n).toBe(0);
      expect(items[0].n).toBe(0);
    });

    it('reports a missing order as 404', async () => {
      await expect(deleteOrder(1)).rejects.toMatchObject({ status: 404 });
    });
  });
});
