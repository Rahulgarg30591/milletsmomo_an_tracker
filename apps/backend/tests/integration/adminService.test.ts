import { describe, it, expect } from 'vitest';
import { getSummary, getAdminOrders } from '../../src/services/adminService.js';
import { createOrder, completeOrder } from '../../src/services/ordersService.js';

const DAY_1 = '2026-04-01';
const DAY_2 = '2026-04-02';
const DAY_3 = '2026-04-03';
const STAFF = 1;

const VEG_STEAM = 1;      // full plate 89
const PANEER_STEAM = 2;   // full plate 109
const COLD_DRINK = 29;    // flat 10
const PLATE = 6;

function order(date: string, paymentMethod: string, items: any[], extra: Record<string, any> = {}) {
  return createOrder(STAFF, { orderDate: date, orderType: 'dine', paymentMethod, items, ...extra });
}

describe('adminService against a real database', () => {
  describe('getSummary for a single day', () => {
    it('counts orders and sums revenue', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_1, 'upi', [{ menuItemId: PANEER_STEAM, quantity: PLATE, isHalf: false }]);

      const summary = await getSummary(DAY_1);
      expect(summary.totalOrders).toBe(2);
      expect(summary.totalRevenue).toBe(89 + 109);
    });

    it('returns counts as numbers, not strings', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      const summary = await getSummary(DAY_1);
      // COUNT and SUM are BIGINT/NUMERIC; without the driver's type parsers
      // these arrive as strings and every total downstream concatenates.
      expect(typeof summary.totalOrders).toBe('number');
      expect(typeof summary.totalRevenue).toBe('number');
    });

    it('splits cash and UPI totals', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_1, 'upi', [{ menuItemId: PANEER_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_1, 'split', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }], {
        cashAmount: 40,
        upiAmount: 49,
      });

      const summary = await getSummary(DAY_1);
      expect(summary.cashTotal).toBe(89 + 40);
      expect(summary.upiTotal).toBe(109 + 49);
    });

    it('reports pending money separately from revenue', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_1, 'pending', [{ menuItemId: PANEER_STEAM, quantity: PLATE, isHalf: false }]);

      const summary = await getSummary(DAY_1);
      expect(summary.pendingAmount).toBe(109);
      expect(summary.totalRevenue).toBe(89 + 109);
    });

    it('returns zeroes for a day with no orders', async () => {
      const summary = await getSummary(DAY_1);
      expect(summary.totalOrders).toBe(0);
      expect(summary.totalRevenue).toBe(0);
      expect(summary.itemBreakdown).toEqual([]);
    });

    it('groups the item breakdown by name, heaviest first', async () => {
      await order(DAY_1, 'cash', [
        { menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false },
        { menuItemId: COLD_DRINK, quantity: 1, isHalf: false },
      ]);
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);

      const summary = await getSummary(DAY_1);
      expect(summary.itemBreakdown[0].itemName).toBe('Veg Steam');
      expect(summary.itemBreakdown[0].totalQuantity).toBe(12);
      expect(typeof summary.itemBreakdown[0].totalQuantity).toBe('number');
    });

    it('ignores other days', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_2, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      expect((await getSummary(DAY_1)).totalOrders).toBe(1);
    });
  });

  describe('getSummary over a range', () => {
    it('includes both end dates', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_2, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_3, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);

      const summary = await getSummary(DAY_1, DAY_3);
      expect(summary.totalOrders).toBe(3);
      expect(summary.totalRevenue).toBe(89 * 3);
    });

    it('excludes days outside the range', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_3, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      expect((await getSummary(DAY_1, DAY_2)).totalOrders).toBe(1);
    });

    it('treats an end date equal to the start as a single day', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_2, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      expect((await getSummary(DAY_1, DAY_1)).totalOrders).toBe(1);
    });

    it('aggregates the item breakdown across the range', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_2, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      const summary = await getSummary(DAY_1, DAY_2);
      expect(summary.itemBreakdown).toHaveLength(1);
      expect(summary.itemBreakdown[0].totalQuantity).toBe(12);
    });
  });

  describe('getAdminOrders', () => {
    it('nests items under each order', async () => {
      await order(DAY_1, 'cash', [
        { menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false },
        { menuItemId: COLD_DRINK, quantity: 2, isHalf: false },
      ]);
      const { orders } = await getAdminOrders(DAY_1);
      expect(orders).toHaveLength(1);
      expect(orders[0].items).toHaveLength(2);
    });

    it('reflects completion state', async () => {
      const placed = await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await completeOrder(placed.id);
      const { orders } = await getAdminOrders(DAY_1);
      expect(orders[0].isCompleted).toBe(true);
    });

    it('spans a date range', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      await order(DAY_3, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      expect((await getAdminOrders(DAY_1, DAY_3)).orders).toHaveLength(2);
    });

    it('matches what getOrders reports for the same day', async () => {
      await order(DAY_1, 'cash', [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }]);
      const admin = (await getAdminOrders(DAY_1)).orders[0];
      const { getOrders } = await import('../../src/services/ordersService.js');
      const staff = (await getOrders(DAY_1)).orders[0];
      // Both read the same rows through the shared mapper; if one query drifts
      // from the other, the shapes stop matching.
      expect(JSON.stringify(admin)).toBe(JSON.stringify(staff));
    });
  });
});
