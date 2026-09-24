import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { query } from '../../src/db/pool.js';
import {
  addRefill,
  updateRefill,
  getRecentSources,
  deleteRefill,
  getRefillsForDate,
  getMonthReport,
} from '../../src/services/cylinderService.js';

const ADMIN = 3;
const STAFF = 1;

describe('cylinderService against a real database', () => {
  describe('addRefill and getRefillsForDate', () => {
    it('records a refill with who logged it', async () => {
      const refill = await addRefill('2026-09-10', { brand: 'HP', amount: 950, source: null }, STAFF);
      expect(refill).toMatchObject({ refillDate: '2026-09-10', brand: 'HP', amount: 950, createdBy: STAFF });
      expect(refill.createdByName).toEqual(expect.any(String));
    });

    it('lists only the day asked for, oldest first', async () => {
      await addRefill('2026-09-10', { brand: 'HP', amount: 950, source: null }, STAFF);
      await addRefill('2026-09-10', { brand: 'INDANE', amount: 905.5, source: null }, STAFF);
      await addRefill('2026-09-11', { brand: 'BP', amount: 910, source: null }, STAFF);

      const refills = await getRefillsForDate('2026-09-10');
      expect(refills.map((r) => r.brand)).toEqual(['HP', 'INDANE']);
      expect(refills[1].amount).toBe(905.5);
    });

    it('refuses an unknown brand', async () => {
      await expect(addRefill('2026-09-10', { brand: 'SHELL' as never, amount: 900, source: null }, STAFF)).rejects.toThrow();
    });

    it('refuses a zero amount', async () => {
      await expect(addRefill('2026-09-10', { brand: 'HP', amount: 0, source: null }, STAFF)).rejects.toThrow();
    });
  });

  describe('deleteRefill', () => {
    it('removes the refill and returns it', async () => {
      const refill = await addRefill('2026-09-10', { brand: 'BP', amount: 910, source: null }, STAFF);
      const deleted = await deleteRefill(refill.id);
      expect(deleted?.id).toBe(refill.id);
      expect(await getRefillsForDate('2026-09-10')).toEqual([]);
    });

    it('returns null for a refill that does not exist', async () => {
      expect(await deleteRefill(999999)).toBeNull();
    });
  });

  describe('getMonthReport', () => {
    it('covers the whole month and nothing outside it', async () => {
      await addRefill('2026-08-31', { brand: 'HP', amount: 100, source: null }, STAFF);
      await addRefill('2026-09-01', { brand: 'HP', amount: 950, source: null }, STAFF);
      await addRefill('2026-09-30', { brand: 'INDANE', amount: 905, source: null }, ADMIN);
      await addRefill('2026-10-01', { brand: 'HP', amount: 100, source: null }, STAFF);

      const report = await getMonthReport('2026-09');
      expect(report.refills.map((r) => r.refillDate)).toEqual(['2026-09-30', '2026-09-01']);
      expect(report.count).toBe(2);
      expect(report.totalAmount).toBe(1855);
    });

    it('totals each brand, listing brands with no refills as zero', async () => {
      await addRefill('2026-09-05', { brand: 'HP', amount: 950, source: null }, STAFF);
      await addRefill('2026-09-20', { brand: 'HP', amount: 960, source: null }, STAFF);
      await addRefill('2026-09-12', { brand: 'BP', amount: 910.25, source: null }, STAFF);

      const { byBrand } = await getMonthReport('2026-09');
      expect(byBrand).toEqual([
        { brand: 'HP', count: 2, totalAmount: 1910 },
        { brand: 'BP', count: 1, totalAmount: 910.25 },
        { brand: 'INDANE', count: 0, totalAmount: 0 },
      ]);
    });

    it('handles December rolling into the next year', async () => {
      await addRefill('2026-12-31', { brand: 'HP', amount: 950, source: null }, STAFF);
      await addRefill('2027-01-01', { brand: 'HP', amount: 950, source: null }, STAFF);
      expect((await getMonthReport('2026-12')).count).toBe(1);
    });
  });

  describe('production migration', () => {
    it('applies cleanly to an existing database, and again', async () => {
      const dir = path.dirname(fileURLToPath(import.meta.url));
      const sql = fs.readFileSync(
        path.resolve(dir, '../../src/db/migrations/2026-09-24-cylinder-refills.sql'),
        'utf-8',
      );
      const kept = await addRefill('2026-09-10', { brand: 'HP', amount: 950, source: null }, STAFF);

      await query(sql);
      await query(sql);

      expect((await getRefillsForDate('2026-09-10')).map((r) => r.id)).toEqual([kept.id]);
      await query(
        `INSERT INTO staff_operation_logs (order_date, operation_type, created_by, details)
         VALUES ('2026-09-10', 'cylinder_refill', $1, 'allowed by the new constraint')`,
        [STAFF],
      );
    });
  });

  describe('source', () => {
    it('stores where the cylinder came from, tidied', async () => {
      const refill = await addRefill('2026-09-10', { brand: 'HP', amount: 950, source: '  Gupta   Gas Agency ' }, STAFF);
      expect(refill.source).toBe('Gupta Gas Agency');
    });

    it('stores a blank source as not recorded', async () => {
      const refill = await addRefill('2026-09-10', { brand: 'HP', amount: 950, source: '   ' }, STAFF);
      expect(refill.source).toBeNull();
    });

    it('suggests sources used before, newest first, one per spelling', async () => {
      await addRefill('2026-09-01', { brand: 'HP', amount: 950, source: 'Gupta Gas' }, STAFF);
      await addRefill('2026-09-02', { brand: 'BP', amount: 910, source: 'Sharma Traders' }, STAFF);
      await addRefill('2026-09-03', { brand: 'HP', amount: 950, source: 'gupta gas' }, STAFF);
      await addRefill('2026-09-04', { brand: 'HP', amount: 950, source: null }, STAFF);

      expect(await getRecentSources()).toEqual(['gupta gas', 'Sharma Traders']);
    });

    it('totals the month by source, ignoring case, biggest spend first', async () => {
      await addRefill('2026-09-01', { brand: 'HP', amount: 950, source: 'Gupta Gas' }, STAFF);
      await addRefill('2026-09-05', { brand: 'HP', amount: 960, source: 'gupta gas' }, STAFF);
      await addRefill('2026-09-09', { brand: 'BP', amount: 910, source: 'Sharma Traders' }, STAFF);
      await addRefill('2026-09-12', { brand: 'INDANE', amount: 905, source: null }, STAFF);

      const { bySource } = await getMonthReport('2026-09');
      expect(bySource).toEqual([
        { source: 'gupta gas', count: 2, totalAmount: 1910 },
        { source: 'Sharma Traders', count: 1, totalAmount: 910 },
        { source: null, count: 1, totalAmount: 905 },
      ]);
    });
  });

  describe('updateRefill', () => {
    it('corrects brand, price and source, keeping the date and first logger', async () => {
      const refill = await addRefill('2026-09-10', { brand: 'HP', amount: 950, source: null }, STAFF);
      const result = await updateRefill(refill.id, { brand: 'BP', amount: 915, source: 'Sharma Traders' }, ADMIN);

      expect(result!.before).toMatchObject({ brand: 'HP', amount: 950, source: null });
      expect(result!.after).toMatchObject({
        id: refill.id, refillDate: '2026-09-10', brand: 'BP', amount: 915,
        source: 'Sharma Traders', createdBy: STAFF,
      });
      expect(result!.after.updatedByName).toEqual(expect.any(String));
      expect(result!.after.updatedAt).toEqual(expect.any(String));
    });

    it('leaves a never-edited refill without an editor', async () => {
      const refill = await addRefill('2026-09-10', { brand: 'HP', amount: 950, source: null }, STAFF);
      expect(refill.updatedAt).toBeNull();
      expect(refill.updatedByName).toBeNull();
    });

    it('returns null for a refill that does not exist', async () => {
      expect(await updateRefill(999999, { brand: 'HP', amount: 950, source: null }, STAFF)).toBeNull();
    });

    it('is reflected in the month report', async () => {
      const refill = await addRefill('2026-09-10', { brand: 'HP', amount: 950, source: null }, STAFF);
      await updateRefill(refill.id, { brand: 'HP', amount: 1000, source: null }, STAFF);
      expect((await getMonthReport('2026-09')).totalAmount).toBe(1000);
    });
  });
});
