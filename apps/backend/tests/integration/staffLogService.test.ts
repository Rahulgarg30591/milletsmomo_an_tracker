import { describe, it, expect } from 'vitest';
import { createLog, getLogs } from '../../src/services/staffLogService.js';

const DAY = '2026-08-20';
const OTHER = '2026-08-21';
const STAFF = 1;
const ADMIN = 3;

describe('staffLogService against a real database', () => {
  it('records an entry and names the person', async () => {
    await createLog(DAY, 'order_create', STAFF, 'placed an order');
    const [log] = await getLogs(DAY);
    expect(log.details).toBe('placed an order');
    expect(log.displayName).toBe('Cart Staff');
    expect(log.operationType).toBe('order_create');
  });

  it('round-trips nested JSON metadata', async () => {
    await createLog(DAY, 'supply_order', ADMIN, 'no supply', { noSupply: true, nested: { n: 42 } });
    const [log] = await getLogs(DAY);
    expect(log.metadata).toEqual({ noSupply: true, nested: { n: 42 } });
  });

  it('stores null metadata when none is given', async () => {
    await createLog(DAY, 'login', STAFF, 'signed in');
    const [log] = await getLogs(DAY);
    expect(log.metadata).toBeNull();
  });

  it('returns newest first', async () => {
    await createLog(DAY, 'order_create', STAFF, 'first');
    await createLog(DAY, 'order_update', STAFF, 'second');
    const logs = await getLogs(DAY);
    expect(logs[0].details).toBe('second');
  });

  it('filters by date', async () => {
    await createLog(DAY, 'login', STAFF, 'today');
    await createLog(OTHER, 'login', STAFF, 'another day');
    expect(await getLogs(DAY)).toHaveLength(1);
  });

  it('filters by operation type', async () => {
    await createLog(DAY, 'order_create', STAFF, 'a');
    await createLog(DAY, 'login', STAFF, 'b');
    const logs = await getLogs(undefined, 'login');
    expect(logs).toHaveLength(1);
    expect(logs[0].details).toBe('b');
  });

  it('honours the limit', async () => {
    for (let i = 0; i < 5; i++) await createLog(DAY, 'login', STAFF, `entry ${i}`);
    expect(await getLogs(DAY, undefined, 3)).toHaveLength(3);
  });

  it('returns createdAt as an ISO timestamp and orderDate as a plain date', async () => {
    await createLog(DAY, 'login', STAFF, 'x');
    const [log] = await getLogs(DAY);
    expect(log.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(log.orderDate).toBe(DAY);
  });

  it('rejects an operation type outside the allowed set', async () => {
    await expect(
      createLog(DAY, 'not_a_real_operation' as never, STAFF, 'x'),
    ).rejects.toThrow();
  });
});
