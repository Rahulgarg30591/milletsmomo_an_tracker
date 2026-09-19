import { describe, it, expect } from 'vitest';
import { query } from '../../src/db/pool.js';
import {
  getExpectedAmounts,
  getSettlement,
  getSettlementSummary,
  createSettlement,
  listSettlements,
} from '../../src/services/paymentSettlementService.js';
import { createOrder } from '../../src/services/ordersService.js';

const DAY = '2026-05-10';
const OTHER_DAY = '2026-05-11';
const ADMIN = 3;
const STAFF = 1;
const VEG_STEAM = 1;    // full plate 89
const PLATE = 6;

function order(date: string, paymentMethod: string, extra: Record<string, any> = {}) {
  return createOrder(STAFF, {
    orderDate: date,
    orderType: 'dine',
    paymentMethod,
    items: [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }],
    ...extra,
  });
}

describe('paymentSettlementService against a real database', () => {
  describe('getExpectedAmounts', () => {
    it('totals cash and UPI from the day\'s orders', async () => {
      await order(DAY, 'cash');
      await order(DAY, 'upi');
      const expected = await getExpectedAmounts(DAY);
      expect(expected.cash).toBe(89);
      expect(expected.upi).toBe(89);
      expect(expected.totalOrders).toBe(2);
    });

    it('excludes pending orders, which are not money in hand yet', async () => {
      await order(DAY, 'cash');
      await order(DAY, 'pending');
      const expected = await getExpectedAmounts(DAY);
      expect(expected.totalOrders).toBe(1);
      expect(expected.cash).toBe(89);
    });

    it('counts both halves of a split order', async () => {
      await order(DAY, 'split', { cashAmount: 50, upiAmount: 39 });
      const expected = await getExpectedAmounts(DAY);
      expect(expected.cash).toBe(50);
      expect(expected.upi).toBe(39);
    });

    it('returns zeroes, not nulls, for a day with no orders', async () => {
      const expected = await getExpectedAmounts(DAY);
      expect(expected.cash).toBe(0);
      expect(expected.upi).toBe(0);
      expect(expected.totalOrders).toBe(0);
    });

    it('returns numbers, not strings', async () => {
      await order(DAY, 'cash');
      const expected = await getExpectedAmounts(DAY);
      expect(typeof expected.cash).toBe('number');
      expect(typeof expected.totalOrders).toBe('number');
    });
  });

  describe('createSettlement', () => {
    it('stores what was counted alongside what was expected', async () => {
      await order(DAY, 'cash');
      const settlement = await createSettlement(DAY, 89, 0, 'all present', ADMIN);
      expect(settlement.expectedCash).toBe(89);
      expect(settlement.actualCash).toBe(89);
      expect(settlement.notes).toBe('all present');
    });

    it('flags a cash shortfall as a conflict', async () => {
      await order(DAY, 'cash');
      const settlement = await createSettlement(DAY, 79, 0, 'short by ten', ADMIN);
      expect(settlement.cashConflict).toBe(true);
      expect(settlement.upiConflict).toBe(false);
    });

    it('does not flag a conflict when the counts match', async () => {
      await order(DAY, 'cash');
      await order(DAY, 'upi');
      const settlement = await createSettlement(DAY, 89, 89, null, ADMIN);
      expect(settlement.cashConflict).toBe(false);
      expect(settlement.upiConflict).toBe(false);
    });

    it('tolerates a rounding difference under a paisa', async () => {
      await order(DAY, 'cash');
      const settlement = await createSettlement(DAY, 89.005, 0, null, ADMIN);
      expect(settlement.cashConflict).toBe(false);
    });

    it('replaces an earlier settlement for the same day rather than duplicating', async () => {
      await order(DAY, 'cash');
      await createSettlement(DAY, 50, 0, 'first count', ADMIN);
      const second = await createSettlement(DAY, 89, 0, 'recount', ADMIN);
      const rows = await query<{ n: number }>(
        'SELECT count(*)::int n FROM daily_payment_settlements WHERE order_date = $1',
        [DAY],
      );
      expect(rows[0].n).toBe(1);
      expect(second.notes).toBe('recount');
    });

    it('returns booleans for the conflict flags, not 0/1', async () => {
      await order(DAY, 'cash');
      const settlement = await createSettlement(DAY, 1, 0, null, ADMIN);
      expect(typeof settlement.cashConflict).toBe('boolean');
    });
  });

  describe('getSettlement and the summary', () => {
    it('returns null before the day is settled', async () => {
      await order(DAY, 'cash');
      expect(await getSettlement(DAY)).toBeNull();
    });

    it('reports isSettled once a settlement exists', async () => {
      await order(DAY, 'cash');
      expect((await getSettlementSummary(DAY)).isSettled).toBe(false);
      await createSettlement(DAY, 89, 0, null, ADMIN);
      const summary = await getSettlementSummary(DAY);
      expect(summary.isSettled).toBe(true);
      expect(summary.settlement?.actualCash).toBe(89);
    });

    it('returns the date as a plain string', async () => {
      await order(DAY, 'cash');
      const settlement = await createSettlement(DAY, 89, 0, null, ADMIN);
      expect(settlement.orderDate).toBe(DAY);
    });

    it('returns createdAt as an ISO timestamp', async () => {
      await order(DAY, 'cash');
      const settlement = await createSettlement(DAY, 89, 0, null, ADMIN);
      expect(settlement.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('listSettlements', () => {
    it('returns settlements in the range, newest first', async () => {
      await order(DAY, 'cash');
      await order(OTHER_DAY, 'cash');
      await createSettlement(DAY, 89, 0, 'day one', ADMIN);
      await createSettlement(OTHER_DAY, 89, 0, 'day two', ADMIN);

      const list = await listSettlements(DAY, OTHER_DAY);
      expect(list).toHaveLength(2);
      expect(list[0].orderDate).toBe(OTHER_DAY);
    });

    it('excludes days outside the range', async () => {
      await order(DAY, 'cash');
      await order(OTHER_DAY, 'cash');
      await createSettlement(DAY, 89, 0, null, ADMIN);
      await createSettlement(OTHER_DAY, 89, 0, null, ADMIN);
      expect(await listSettlements(DAY, DAY)).toHaveLength(1);
    });

    it('returns an empty list when nothing is settled', async () => {
      expect(await listSettlements(DAY, OTHER_DAY)).toEqual([]);
    });
  });
});
