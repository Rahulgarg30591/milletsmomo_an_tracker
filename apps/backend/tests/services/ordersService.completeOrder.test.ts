import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/pool.js', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

import { query } from '../../src/db/pool.js';
import { completeOrder } from '../../src/services/ordersService.js';

const mockQuery = query as unknown as ReturnType<typeof vi.fn>;

/** An open order already carrying a settled cash/UPI split. */
function openOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    order_date: '2026-09-18',
    payment_method: 'split',
    is_completed: false,
    total_amount: 120,
    cash_amount: 70,
    upi_amount: 50,
    ...overrides,
  };
}

/**
 * Stands in for the database, returning only the columns the SELECT actually
 * names.
 *
 * Projecting is the whole point: a mock that hands back the full row no matter
 * what was asked for cannot fail when a query stops selecting a column, which
 * is exactly the defect these tests exist to catch.
 */
function mockOrder(row: Record<string, unknown>) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (text: string) => {
    const select = /^\s*SELECT\s+([\s\S]+?)\s+FROM\s/i.exec(text);
    if (!select) return [];
    const columns = select[1].split(',').map((c) => c.trim().split(/\s+/).pop()!);
    const projected: Record<string, unknown> = {};
    for (const column of columns) {
      if (column in row) projected[column] = row[column];
    }
    return [projected];
  });
}

describe('completeOrder', () => {
  beforeEach(() => mockQuery.mockReset());

  it('reports the amounts already on the order when no payment method is given', async () => {
    mockOrder(openOrder());
    const result = await completeOrder(1);
    // Regression: the SELECT used to omit cash_amount and upi_amount, so this
    // branch read undefined and reported a settled ₹70/₹50 order as 0 / 0.
    expect(result.cashAmount).toBe(70);
    expect(result.upiAmount).toBe(50);
    expect(result.paymentMethod).toBe('split');
    expect(result.totalAmount).toBe(120);
  });

  it('assigns the full total to cash when completing as cash', async () => {
    mockOrder(openOrder({ payment_method: 'pending', cash_amount: 0, upi_amount: 0 }));
    const result = await completeOrder(1, 'cash');
    expect(result.cashAmount).toBe(120);
    expect(result.upiAmount).toBe(0);
  });

  it('assigns the full total to UPI when completing as UPI', async () => {
    mockOrder(openOrder({ payment_method: 'pending', cash_amount: 0, upi_amount: 0 }));
    const result = await completeOrder(1, 'upi');
    expect(result.cashAmount).toBe(0);
    expect(result.upiAmount).toBe(120);
  });

  it('uses the supplied split amounts', async () => {
    mockOrder(openOrder({ payment_method: 'pending' }));
    const result = await completeOrder(1, 'split', 40, 80);
    expect(result.cashAmount).toBe(40);
    expect(result.upiAmount).toBe(80);
  });

  it('derives the UPI side of a split when only cash is supplied', async () => {
    mockOrder(openOrder({ payment_method: 'pending' }));
    const result = await completeOrder(1, 'split', 40);
    expect(result.upiAmount).toBe(80);
  });

  it('rejects an order that is already completed', async () => {
    mockOrder(openOrder({ is_completed: true }));
    await expect(completeOrder(1)).rejects.toMatchObject({ status: 400 });
  });

  it('requires a payment method for a pending order', async () => {
    mockOrder(openOrder({ payment_method: 'pending' }));
    await expect(completeOrder(1)).rejects.toMatchObject({ status: 400 });
  });

  it('reports a missing order as 404', async () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce([]);
    await expect(completeOrder(999)).rejects.toMatchObject({ status: 404 });
  });
});
