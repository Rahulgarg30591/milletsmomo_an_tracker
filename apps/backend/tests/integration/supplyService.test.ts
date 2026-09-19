import { describe, it, expect } from 'vitest';
import { query } from '../../src/db/pool.js';
import {
  getSupplyItems,
  getSupplyOrder,
  createSupplyOrder,
  updateSupplyOrder,
  listSupplyOrders,
  getSupplyOrderLogs,
} from '../../src/services/supplyService.js';

const DAY = '2026-06-01';
const DAY_2 = '2026-06-02';
const DAY_3 = '2026-06-03';
const ADMIN = 3;

const VEG_PACKET = 1;        // 138.00, 24 pieces
const PANEER_PACKET = 2;     // 158.00
const RED_SAUCE = 4;         // 80.00, sauce

describe('supplyService against a real database', () => {
  describe('getSupplyItems', () => {
    it('returns the active catalogue ordered packets, sauces, dips', async () => {
      const items = await getSupplyItems();
      expect(items).toHaveLength(8);
      expect(items[0].category).toBe('momo_packet');
      expect(items.at(-1)!.category).toBe('dip');
    });

    it('returns prices as numbers', async () => {
      const [first] = await getSupplyItems();
      expect(typeof first.unitPrice).toBe('number');
      expect(typeof first.piecesPer).toBe('number');
    });
  });

  describe('createSupplyOrder', () => {
    it('totals the order from catalogue prices, not client input', async () => {
      const order = await createSupplyOrder(DAY, [
        { supplyItemId: VEG_PACKET, quantity: 3 },
        { supplyItemId: RED_SAUCE, quantity: 2 },
      ], ADMIN);
      expect(order.totalCost).toBe(138 * 3 + 80 * 2);
    });

    it('stores a line per item with its own line total', async () => {
      const order = await createSupplyOrder(DAY, [
        { supplyItemId: VEG_PACKET, quantity: 2 },
        { supplyItemId: PANEER_PACKET, quantity: 1 },
      ], ADMIN);
      expect(order.items).toHaveLength(2);
      const veg = order.items.find((i) => i.supplyItemId === VEG_PACKET)!;
      expect(veg.lineTotal).toBe(276);
    });

    it('writes a CREATE log naming the items', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      const logs = await getSupplyOrderLogs(DAY);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('CREATE');
      expect(logs[0].itemSummary).toContain('Veg Momo Packet');
    });

    it('rejects an unknown supply item and writes nothing', async () => {
      await expect(
        createSupplyOrder(DAY, [{ supplyItemId: 9999, quantity: 1 }], ADMIN),
      ).rejects.toMatchObject({ status: 400 });
      const rows = await query<{ n: number }>('SELECT count(*)::int n FROM daily_supply_orders');
      expect(rows[0].n).toBe(0);
    });

    it('refuses a second order for the same day', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      // uq_daily_supply_orders_date guards one order per day.
      await expect(
        createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN),
      ).rejects.toThrow();
    });
  });

  describe('getSupplyOrder', () => {
    it('returns null for a day with no order', async () => {
      expect(await getSupplyOrder(DAY)).toBeNull();
    });

    it('returns the date as a plain string', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      expect((await getSupplyOrder(DAY))!.orderDate).toBe(DAY);
    });
  });

  describe('updateSupplyOrder', () => {
    it('replaces the order rather than adding a second one', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      const updated = await updateSupplyOrder(DAY, [{ supplyItemId: PANEER_PACKET, quantity: 1 }], ADMIN);
      expect(updated.totalCost).toBe(158);
      const rows = await query<{ n: number }>(
        'SELECT count(*)::int n FROM daily_supply_orders WHERE order_date = $1', [DAY],
      );
      expect(rows[0].n).toBe(1);
    });

    it('logs the change as UPDATE, keeping the original CREATE', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      await updateSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 5 }], ADMIN);
      const logs = await getSupplyOrderLogs(DAY);
      expect(logs.map((l) => l.action).sort()).toEqual(['CREATE', 'UPDATE']);
    });

    it('clears verifications for the day, since the expected quantities changed', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      await query(
        `INSERT INTO supply_verifications (order_date, supply_item_id, expected_qty, actual_qty, has_conflict, reported_by)
         VALUES ($1, $2, 3, 3, FALSE, $3)`,
        [DAY, VEG_PACKET, ADMIN],
      );
      await updateSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 5 }], ADMIN);
      const rows = await query<{ n: number }>(
        'SELECT count(*)::int n FROM supply_verifications WHERE order_date = $1', [DAY],
      );
      expect(rows[0].n).toBe(0);
    });

    it('creates the order when the day had none', async () => {
      const created = await updateSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 2 }], ADMIN);
      expect(created.totalCost).toBe(276);
    });
  });

  describe('listSupplyOrders', () => {
    it('returns each order with its own items, newest first', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      await createSupplyOrder(DAY_2, [
        { supplyItemId: VEG_PACKET, quantity: 1 },
        { supplyItemId: RED_SAUCE, quantity: 2 },
      ], ADMIN);

      const list = await listSupplyOrders(DAY, DAY_2);
      expect(list).toHaveLength(2);
      expect(list[0].orderDate).toBe(DAY_2);
      // Items are loaded for all orders in one query and grouped by order id;
      // a grouping mistake shows up as items landing on the wrong order.
      expect(list[0].items).toHaveLength(2);
      expect(list[1].items).toHaveLength(1);
    });

    it('keeps each order\'s totals with that order', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      await createSupplyOrder(DAY_2, [{ supplyItemId: PANEER_PACKET, quantity: 2 }], ADMIN);
      const list = await listSupplyOrders(DAY, DAY_2);
      expect(list.find((o) => o.orderDate === DAY)!.totalCost).toBe(138);
      expect(list.find((o) => o.orderDate === DAY_2)!.totalCost).toBe(316);
    });

    it('excludes days outside the range', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      await createSupplyOrder(DAY_3, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      expect(await listSupplyOrders(DAY, DAY_2)).toHaveLength(1);
    });

    it('returns an empty list when there is nothing in range', async () => {
      expect(await listSupplyOrders(DAY, DAY_3)).toEqual([]);
    });
  });

  describe('getSupplyOrderLogs', () => {
    it('names the person who made the change', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      const [log] = await getSupplyOrderLogs(DAY);
      expect(log.displayName).toBe('Owner');
    });

    it('is empty for a day with no supply activity', async () => {
      expect(await getSupplyOrderLogs(DAY)).toEqual([]);
    });
  });
});
