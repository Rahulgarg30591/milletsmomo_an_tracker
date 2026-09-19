import { describe, it, expect } from 'vitest';
import { query } from '../../src/db/pool.js';
import {
  getVerification,
  listVerifications,
  createVerification,
} from '../../src/services/supplyVerificationService.js';
import { createSupplyOrder } from '../../src/services/supplyService.js';
import { createLog } from '../../src/services/staffLogService.js';

const DAY = '2026-07-01';
const DAY_2 = '2026-07-02';
const ADMIN = 3;
const STAFF = 1;
const VEG_PACKET = 1;
const RED_SAUCE = 4;

describe('supplyVerificationService against a real database', () => {
  describe('getVerification', () => {
    it('returns null when no supply was ordered and nothing was declared', async () => {
      expect(await getVerification(DAY)).toBeNull();
    });

    it('reports noSupply when the admin marked the day as having none', async () => {
      await createLog(DAY, 'supply_order', ADMIN, 'no supply today', { noSupply: true });
      const result = await getVerification(DAY);
      expect(result?.noSupply).toBe(true);
      expect(result?.items).toEqual([]);
    });

    it('lists the ordered items as awaiting verification', async () => {
      await createSupplyOrder(DAY, [
        { supplyItemId: VEG_PACKET, quantity: 3 },
        { supplyItemId: RED_SAUCE, quantity: 2 },
      ], ADMIN);

      const result = await getVerification(DAY);
      expect(result?.items).toHaveLength(2);
      expect(result?.isFullyVerified).toBe(false);
      expect(result?.items[0].actualQty).toBeNull();
      expect(result?.items[0].expectedQty).toBe(3);
    });

    it('marks the day verified once every item is counted', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      await createVerification(DAY, [{ supplyItemId: VEG_PACKET, expectedQty: 3, actualQty: 3 }], STAFF);
      const result = await getVerification(DAY);
      expect(result?.isFullyVerified).toBe(true);
      expect(result?.conflictCount).toBe(0);
    });
  });

  describe('createVerification', () => {
    it('flags a conflict when the count differs from the order', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      const result = await createVerification(
        DAY, [{ supplyItemId: VEG_PACKET, expectedQty: 3, actualQty: 2 }], STAFF,
      );
      expect(result.conflictCount).toBe(1);
      expect(result.items[0].hasConflict).toBe(true);
    });

    it('records no conflict when the count matches', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      const result = await createVerification(
        DAY, [{ supplyItemId: VEG_PACKET, expectedQty: 3, actualQty: 3 }], STAFF,
      );
      expect(result.conflictCount).toBe(0);
      expect(result.items[0].hasConflict).toBe(false);
    });

    it('replaces an earlier count for the same day', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      await createVerification(DAY, [{ supplyItemId: VEG_PACKET, expectedQty: 3, actualQty: 1 }], STAFF);
      await createVerification(DAY, [{ supplyItemId: VEG_PACKET, expectedQty: 3, actualQty: 3 }], STAFF);
      const rows = await query<{ n: number }>(
        'SELECT count(*)::int n FROM supply_verifications WHERE order_date = $1', [DAY],
      );
      expect(rows[0].n).toBe(1);
      expect((await getVerification(DAY))?.conflictCount).toBe(0);
    });

    it('writes every item in one go', async () => {
      await createSupplyOrder(DAY, [
        { supplyItemId: VEG_PACKET, quantity: 3 },
        { supplyItemId: RED_SAUCE, quantity: 2 },
      ], ADMIN);
      await createVerification(DAY, [
        { supplyItemId: VEG_PACKET, expectedQty: 3, actualQty: 3 },
        { supplyItemId: RED_SAUCE, expectedQty: 2, actualQty: 2 },
      ], STAFF);
      const rows = await query<{ n: number }>(
        'SELECT count(*)::int n FROM supply_verifications WHERE order_date = $1', [DAY],
      );
      expect(rows[0].n).toBe(2);
    });
  });

  describe('listVerifications', () => {
    it('summarises each day in the range', async () => {
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 3 }], ADMIN);
      await createVerification(DAY, [{ supplyItemId: VEG_PACKET, expectedQty: 3, actualQty: 2 }], STAFF);
      await createSupplyOrder(DAY_2, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      await createVerification(DAY_2, [{ supplyItemId: VEG_PACKET, expectedQty: 1, actualQty: 1 }], STAFF);

      const list = await listVerifications(DAY, DAY_2);
      expect(list).toHaveLength(2);
      expect(list[0].orderDate).toBe(DAY_2);
      expect(list.find((d) => d.orderDate === DAY)!.conflictCount).toBe(1);
    });

    it('compares counts numerically, not as text', async () => {
      // COUNT and SUM come back as BIGINT; comparing them as strings made
      // "10" !== "10" style mistakes possible before the type parsers.
      await createSupplyOrder(DAY, [{ supplyItemId: VEG_PACKET, quantity: 1 }], ADMIN);
      await createVerification(DAY, [{ supplyItemId: VEG_PACKET, expectedQty: 1, actualQty: 1 }], STAFF);
      const [day] = await listVerifications(DAY, DAY);
      expect(day.isFullyVerified).toBe(true);
      expect(typeof day.conflictCount).toBe('number');
    });

    it('returns an empty list when nothing was verified', async () => {
      expect(await listVerifications(DAY, DAY_2)).toEqual([]);
    });
  });
});
