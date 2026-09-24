import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { query } from '../../src/db/pool.js';
import {
  addLeave, updateLeave, deleteLeave, getLeaveMonth, getStaffNames,
  addTakeaway, updateTakeaway, deleteTakeaway, getTakeawayMonth, getTakeawayItemsForDate,
} from '../../src/services/staffService.js';
import { createOrder } from '../../src/services/ordersService.js';
import { getSummary, getAdminOrders } from '../../src/services/adminService.js';
import { getExpectedAmounts } from '../../src/services/paymentSettlementService.js';
import { getMinimumSaleValue } from '../../src/services/minimumSaleValueService.js';
import { createClosingStock } from '../../src/services/closingStockService.js';
import { createSupplyOrder } from '../../src/services/supplyService.js';

const ADMIN = 3;
const STAFF = 1;
const VEG_STEAM = 1;     // full 89, half 50
const PANEER_STEAM = 2;  // full 109

function leave(staffName: string, leaveDate: string, reason: string | null = null) {
  return addLeave({ staffName, leaveDate, reason }, ADMIN);
}

const PLATTER_STEAM = 4;
const VEG_PACKET = 1;
const COLD_DRINK = 29;

function takeaway(
  takeawayDate: string,
  staffName: string,
  items = [{ menuItemId: VEG_STEAM, quantity: 6, isHalf: false }],
  note: string | null = null,
) {
  return addTakeaway({ staffName, takeawayDate, note, items }, ADMIN);
}

describe('staffService against a real database', () => {
  describe('leaves', () => {
    it('records a leave with who marked it', async () => {
      const l = await leave('Ramesh', '2026-09-10', 'Fever');
      expect(l).toMatchObject({ staffName: 'Ramesh', leaveDate: '2026-09-10', reason: 'Fever', updatedAt: null });
      expect(l.createdByName).toEqual(expect.any(String));
    });

    it('tidies the name and treats a blank reason as none', async () => {
      const l = await leave('  Ramesh   Kumar ', '2026-09-10', '   ');
      expect(l.staffName).toBe('Ramesh Kumar');
      expect(l.reason).toBeNull();
    });

    it('refuses the same person twice on one day, whatever the case', async () => {
      await leave('Ramesh', '2026-09-10');
      await expect(leave('ramesh', '2026-09-10')).rejects.toMatchObject({ status: 409 });
    });

    it('allows the same person on another day, and others on the same day', async () => {
      await leave('Ramesh', '2026-09-10');
      await leave('Ramesh', '2026-09-11');
      await leave('Suresh', '2026-09-10');
      expect((await getLeaveMonth('2026-09')).count).toBe(3);
    });

    it('edits a leave, keeping before and after', async () => {
      const l = await leave('Ramesh', '2026-09-10', 'Fever');
      const result = await updateLeave(l.id, { staffName: 'Ramesh', leaveDate: '2026-09-12', reason: 'Wedding' }, ADMIN);
      expect(result!.before).toMatchObject({ leaveDate: '2026-09-10', reason: 'Fever' });
      expect(result!.after).toMatchObject({ leaveDate: '2026-09-12', reason: 'Wedding' });
      expect(result!.after.updatedAt).toEqual(expect.any(String));
    });

    it('refuses an edit onto a day the person is already off', async () => {
      await leave('Ramesh', '2026-09-10');
      const other = await leave('Ramesh', '2026-09-11');
      await expect(updateLeave(other.id, { staffName: 'Ramesh', leaveDate: '2026-09-10', reason: null }, ADMIN))
        .rejects.toMatchObject({ status: 409 });
    });

    it('returns null editing or deleting a leave that does not exist', async () => {
      expect(await updateLeave(999999, { staffName: 'X', leaveDate: '2026-09-10', reason: null }, ADMIN)).toBeNull();
      expect(await deleteLeave(999999)).toBeNull();
    });

    it('deletes a leave', async () => {
      const l = await leave('Ramesh', '2026-09-10');
      expect((await deleteLeave(l.id))?.id).toBe(l.id);
      expect((await getLeaveMonth('2026-09')).count).toBe(0);
    });

    it('reports the month newest first, days per person, nothing outside it', async () => {
      await leave('Ramesh', '2026-08-31');
      await leave('Ramesh', '2026-09-01');
      await leave('ramesh', '2026-09-15');
      await leave('Suresh', '2026-09-20');
      await leave('Ramesh', '2026-10-01');

      const report = await getLeaveMonth('2026-09');
      expect(report.leaves.map((l) => l.leaveDate)).toEqual(['2026-09-20', '2026-09-15', '2026-09-01']);
      expect(report.byStaff).toEqual([
        { staffName: 'ramesh', count: 2 },
        { staffName: 'Suresh', count: 1 },
      ]);
    });
  });

  describe('takeaways', () => {
    it('prices at 25% off the menu, as what the staff member owes', async () => {
      const t = await takeaway('2026-09-10', 'Ramesh');
      expect(t).toMatchObject({ staffName: 'Ramesh', menuValue: 89, discountPct: 25, amountOwed: 66.75, pieces: 6 });
      expect(t.items[0]).toMatchObject({ itemName: 'Veg Steam', menuPrice: 89, lineTotal: 66.75 });
    });

    it('prices a half plate at its half price, then the discount', async () => {
      const t = await takeaway('2026-09-10', 'Ramesh', [{ menuItemId: VEG_STEAM, quantity: 3, isHalf: true }]);
      expect(t).toMatchObject({ menuValue: 50, amountOwed: 37.5 });
    });

    it('adds up several items', async () => {
      const t = await takeaway('2026-09-10', 'Ramesh', [
        { menuItemId: VEG_STEAM, quantity: 6, isHalf: false },
        { menuItemId: PANEER_STEAM, quantity: 12, isHalf: false },
      ]);
      expect(t).toMatchObject({ menuValue: 89 + 218, amountOwed: 230.25, pieces: 18 });
    });

    it('keeps a note and tidies the name', async () => {
      const t = await takeaway('2026-09-10', '  Ramesh   Kumar ', undefined, 'Lunch');
      expect(t).toMatchObject({ staffName: 'Ramesh Kumar', note: 'Lunch' });
    });

    it('refuses beverages, unknown items, no items and no name', async () => {
      await expect(takeaway('2026-09-10', 'Ramesh', [{ menuItemId: COLD_DRINK, quantity: 1, isHalf: false }]))
        .rejects.toMatchObject({ status: 400 });
      await expect(takeaway('2026-09-10', 'Ramesh', [{ menuItemId: 9999, quantity: 6, isHalf: false }]))
        .rejects.toMatchObject({ status: 400 });
      await expect(takeaway('2026-09-10', 'Ramesh', [])).rejects.toMatchObject({ status: 400 });
      await expect(takeaway('2026-09-10', '  ')).rejects.toMatchObject({ status: 400 });
    });

    it('edits a takeaway, repricing it and keeping before and after', async () => {
      const t = await takeaway('2026-09-10', 'Ramesh');
      const result = await updateTakeaway(t.id, {
        staffName: 'Suresh', takeawayDate: '2026-09-11', note: null,
        items: [{ menuItemId: PANEER_STEAM, quantity: 6, isHalf: false }],
      }, ADMIN);
      expect(result!.before).toMatchObject({ staffName: 'Ramesh', amountOwed: 66.75 });
      expect(result!.after).toMatchObject({ staffName: 'Suresh', takeawayDate: '2026-09-11', menuValue: 109, amountOwed: 81.75 });
      expect(result!.after.items).toHaveLength(1);
      expect(result!.after.updatedAt).toEqual(expect.any(String));
    });

    it('returns null editing or deleting one that does not exist', async () => {
      const input = { staffName: 'X', takeawayDate: '2026-09-10', note: null, items: [{ menuItemId: VEG_STEAM, quantity: 6, isHalf: false }] };
      expect(await updateTakeaway(999999, input, ADMIN)).toBeNull();
      expect(await deleteTakeaway(999999)).toBeNull();
    });

    it('deletes a takeaway with its items', async () => {
      const t = await takeaway('2026-09-10', 'Ramesh');
      expect((await deleteTakeaway(t.id))?.id).toBe(t.id);
      expect(await getTakeawayItemsForDate('2026-09-10')).toEqual([]);
    });

    it('reports the month newest first, with what each person owes', async () => {
      await takeaway('2026-08-31', 'Ramesh');
      await takeaway('2026-09-05', 'Ramesh');
      await takeaway('2026-09-06', 'ramesh', [{ menuItemId: VEG_STEAM, quantity: 3, isHalf: true }]);
      await takeaway('2026-09-07', 'Suresh', [{ menuItemId: PANEER_STEAM, quantity: 6, isHalf: false }]);
      await takeaway('2026-10-01', 'Ramesh');

      const report = await getTakeawayMonth('2026-09');
      expect(report.takeaways.map((t) => t.takeawayDate)).toEqual(['2026-09-07', '2026-09-06', '2026-09-05']);
      expect(report).toMatchObject({ count: 3, pieces: 15, menuValue: 248, amountOwed: 186, discountPct: 25 });
      expect(report.byStaff).toEqual([
        { staffName: 'ramesh', count: 2, pieces: 9, menuValue: 139, amountOwed: 104.25 },
        { staffName: 'Suresh', count: 1, pieces: 6, menuValue: 109, amountOwed: 81.75 },
      ]);
    });

    it('lists the day\u2019s items for the stock screens', async () => {
      await takeaway('2026-09-10', 'Ramesh', [
        { menuItemId: VEG_STEAM, quantity: 6, isHalf: false },
        { menuItemId: PANEER_STEAM, quantity: 3, isHalf: true },
      ]);
      await takeaway('2026-09-11', 'Suresh');
      expect(await getTakeawayItemsForDate('2026-09-10')).toEqual([
        { menuItemId: VEG_STEAM, quantity: 6 },
        { menuItemId: PANEER_STEAM, quantity: 3 },
      ]);
    });
  });

  describe('takeaways and the money', () => {
    const DAY = '2026-09-10';
    function sale() {
      return createOrder(STAFF, {
        orderDate: DAY, orderType: 'dine', paymentMethod: 'cash',
        items: [{ menuItemId: VEG_STEAM, quantity: 6, isHalf: false }],
      });
    }

    it('are not sales: summary, order list and settlement see only real orders', async () => {
      await sale();
      await takeaway(DAY, 'Ramesh');
      const summary = await getSummary(DAY);
      expect(summary).toMatchObject({ totalOrders: 1, totalRevenue: 89, cashTotal: 89 });
      expect((await getAdminOrders(DAY)).orders).toHaveLength(1);
      expect(await getExpectedAmounts(DAY)).toEqual({ totalOrders: 1, cash: 89, upi: 0 });
    });

    it('are not counted as sold in the minimum sale value', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      await takeaway(DAY, 'Ramesh');  // 6 veg momos
      await createClosingStock(DAY, [{
        supplyItemId: VEG_PACKET, packetsLeft: 0, piecesLeft: 12,
        wastagePieces: 0, hasConflict: false, conflictReason: null,
      }], STAFF);
      const veg = (await getMinimumSaleValue(DAY))!.fillings.find((f) => f.filling === 'Veg')!;
      // 24 opening - 12 left - 6 taken = 6 sold
      expect(veg.staffTakeawayPieces).toBe(6);
      expect(veg.consumedPieces).toBe(6);
    });

    it('split a platter across the three fillings', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      await takeaway(DAY, 'Ramesh', [{ menuItemId: PLATTER_STEAM, quantity: 6, isHalf: false }]);
      await createClosingStock(DAY, [{
        supplyItemId: VEG_PACKET, packetsLeft: 0, piecesLeft: 0,
        wastagePieces: 0, hasConflict: false, conflictReason: null,
      }], STAFF);
      const result = (await getMinimumSaleValue(DAY))!;
      for (const f of ['Veg', 'Paneer', 'Cheese Corn']) {
        expect(result.fillings.find((x) => x.filling === f)!.staffTakeawayPieces).toBe(2);
      }
    });
  });

  describe('staff name suggestions', () => {
    it('draws on leaves and takeaways, newest first, one per spelling', async () => {
      await leave('Ramesh', '2026-09-01');
      await takeaway('2026-09-02', 'Suresh');
      await leave('ramesh', '2026-09-03');

      expect(await getStaffNames()).toEqual(['ramesh', 'Suresh']);
    });
  });

  describe('production migrations', () => {
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/db/migrations');
    const cylinder = fs.readFileSync(path.join(dir, '2026-09-24-cylinder-refills.sql'), 'utf-8');
    const staff = fs.readFileSync(path.join(dir, '2026-09-25-staff-leaves-takeaways.sql'), 'utf-8');

    async function logTypesStillAllowed() {
      for (const type of ['cylinder_refill', 'staff_leave', 'staff_takeaway', 'order_create']) {
        await query(
          `INSERT INTO staff_operation_logs (order_date, operation_type, created_by, details)
           VALUES ('2026-09-10', $1, $2, 'check')`,
          [type, ADMIN],
        );
      }
    }

    it('keep every log type whichever runs last, however often', async () => {
      const kept = await leave('Ramesh', '2026-09-10');
      await takeaway('2026-09-10', 'Suresh');

      for (const sql of [staff, cylinder, cylinder, staff, cylinder]) await query(sql);

      await logTypesStillAllowed();
      expect((await getLeaveMonth('2026-09')).leaves.map((l) => l.id)).toEqual([kept.id]);
      expect((await getTakeawayMonth('2026-09')).count).toBe(1);
    });
  });
});
