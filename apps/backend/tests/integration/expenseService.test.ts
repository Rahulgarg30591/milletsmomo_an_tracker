import { describe, it, expect } from 'vitest';
import { query } from '../../src/db/pool.js';
import { getDayExpenses, saveDayExpenses } from '../../src/services/expenseService.js';

const DAY = '2026-08-10';
const OTHER = '2026-08-11';
const STAFF = 1;

describe('expenseService against a real database', () => {
  it('returns an empty day with a zero total', async () => {
    const day = await getDayExpenses(DAY);
    expect(day.items).toEqual([]);
    expect(day.totalAmount).toBe(0);
  });

  it('saves several expenses and totals them', async () => {
    const day = await saveDayExpenses(DAY, [
      { description: 'gas cylinder', amount: 1150 },
      { description: 'vegetables', amount: 340.5 },
    ], STAFF);
    expect(day.items).toHaveLength(2);
    expect(day.totalAmount).toBe(1490.5);
  });

  it('keeps decimal amounts exact to the paisa', async () => {
    const day = await saveDayExpenses(DAY, [
      { description: 'a', amount: 10.05 },
      { description: 'b', amount: 20.95 },
    ], STAFF);
    expect(day.totalAmount).toBe(31);
    expect(typeof day.items[0].amount).toBe('number');
  });

  it('replaces the day rather than appending to it', async () => {
    await saveDayExpenses(DAY, [{ description: 'first', amount: 100 }], STAFF);
    const second = await saveDayExpenses(DAY, [{ description: 'second', amount: 50 }], STAFF);
    expect(second.items).toHaveLength(1);
    expect(second.items[0].description).toBe('second');
  });

  it('clears the day when saved with no items', async () => {
    await saveDayExpenses(DAY, [{ description: 'first', amount: 100 }], STAFF);
    const cleared = await saveDayExpenses(DAY, [], STAFF);
    expect(cleared.items).toEqual([]);
    expect(cleared.totalAmount).toBe(0);
  });

  it('leaves other days untouched', async () => {
    await saveDayExpenses(DAY, [{ description: 'day one', amount: 100 }], STAFF);
    await saveDayExpenses(OTHER, [{ description: 'day two', amount: 200 }], STAFF);
    expect((await getDayExpenses(DAY)).totalAmount).toBe(100);
    expect((await getDayExpenses(OTHER)).totalAmount).toBe(200);
  });

  it('rejects a non-positive amount at the database level', async () => {
    await expect(
      saveDayExpenses(DAY, [{ description: 'free', amount: 0 }], STAFF),
    ).rejects.toThrow();
  });

  it('writes all rows in one statement', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ description: `item ${i}`, amount: i + 1 }));
    const day = await saveDayExpenses(DAY, many, STAFF);
    expect(day.items).toHaveLength(25);
    const rows = await query<{ n: number }>(
      'SELECT count(*)::int n FROM day_expenses WHERE order_date = $1', [DAY],
    );
    expect(rows[0].n).toBe(25);
  });
});
