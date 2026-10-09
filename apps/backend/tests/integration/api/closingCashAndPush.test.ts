import { describe, it, expect, vi, beforeEach } from 'vitest';

const sent = vi.hoisted(() => {
  process.env.VAPID_PUBLIC_KEY = 'test-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-private-key';
  return [] as { endpoint: string; payload: any }[];
});

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
      if (sub.endpoint.includes('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    }),
  },
}));

import { app, request, authHeader } from './helpers.js';
import { query } from '../../../src/db/pool.js';

const DATE = '2026-10-05';
const SUB = { endpoint: 'https://push.example.com/admin-phone', keys: { p256dh: 'p', auth: 'a' } };

async function subscribeAdmin(sub = SUB) {
  const res = await request(app).post('/api/push/subscription').set(await authHeader('admin')).send(sub);
  expect(res.status).toBe(201);
}

/** quantity is in momos: 6 is one full plate. */
function order(items: { menuItemId: number; quantity: number }[], paymentMethod = 'cash') {
  return { orderDate: DATE, orderType: 'dine', paymentMethod, items: items.map((i) => ({ ...i, isHalf: false })) };
}

beforeEach(() => {
  sent.length = 0;
});

describe('closing cash API', () => {
  it('staff record the amount and see only the amount', async () => {
    const staff = await authHeader('staff');
    const saved = await request(app).put('/api/supply/closing-cash').set(staff).send({ orderDate: DATE, amount: 1250 });
    expect(saved.status).toBe(201);
    expect(saved.body.amount).toBe(1250);

    const read = await request(app).get(`/api/supply/closing-cash?date=${DATE}`).set(staff);
    expect(read.body.amount).toBe(1250);
    expect(read.body).not.toHaveProperty('difference');
    expect(read.body).not.toHaveProperty('expectedCash');
  });

  it('admin see expected cash (cash sales less expenses) and the difference', async () => {
    const staff = await authHeader('staff');
    await request(app).post('/api/orders').set(staff).send(order([{ menuItemId: 1, quantity: 12 }])); // 2 plates x 89
    await request(app).put('/api/expenses').set(staff).send({ orderDate: DATE, items: [{ description: 'milk', amount: 28 }] });
    await request(app).put('/api/supply/closing-cash').set(staff).send({ orderDate: DATE, amount: 140 });

    const review = await request(app).get(`/api/supply/closing-cash?date=${DATE}`).set(await authHeader('admin'));
    expect(review.body).toMatchObject({ amount: 140, cashSales: 178, expenses: 28, expectedCash: 150, difference: -10 });
  });

  it('a re-count replaces the amount, and an unrecorded day has no difference', async () => {
    const staff = await authHeader('staff');
    await request(app).put('/api/supply/closing-cash').set(staff).send({ orderDate: DATE, amount: 100 });
    await request(app).put('/api/supply/closing-cash').set(staff).send({ orderDate: DATE, amount: 120 });
    const rows = await query('SELECT amount FROM daily_closing_cash');
    expect(rows).toEqual([{ amount: 120 }]);

    const empty = await request(app).get('/api/supply/closing-cash?date=2026-10-06').set(await authHeader('admin'));
    expect(empty.body).toMatchObject({ amount: null, difference: null });
  });

  it('rejects a negative amount', async () => {
    const res = await request(app).put('/api/supply/closing-cash').set(await authHeader('staff')).send({ orderDate: DATE, amount: -1 });
    expect(res.status).toBe(400);
  });
});

describe('admin push notifications', () => {
  it('only admin can subscribe', async () => {
    const res = await request(app).post('/api/push/subscription').set(await authHeader('staff')).send(SUB);
    expect(res.status).toBe(403);
    const key = await request(app).get('/api/push/public-key').set(await authHeader('admin'));
    expect(key.body.publicKey).toBe('test-public-key');
  });

  it('notifies on the first order, and on orders above ₹400, but not on others', async () => {
    await subscribeAdmin();
    const staff = await authHeader('staff');
    await request(app).post('/api/orders').set(staff).send(order([{ menuItemId: 1, quantity: 6 }])); // 89, first
    await request(app).post('/api/orders').set(staff).send(order([{ menuItemId: 1, quantity: 6 }])); // 89
    await request(app).post('/api/orders').set(staff).send(order([{ menuItemId: 1, quantity: 30 }])); // 5 plates, 445
    expect(sent.map((s) => s.payload.title)).toEqual(['First order of the day', 'Large order']);
  });

  it('notifies on verification, closing stock, expenses and closing cash', async () => {
    await subscribeAdmin();
    const staff = await authHeader('staff');
    await request(app).post('/api/supply/verification').set(staff)
      .send({ orderDate: DATE, items: [{ supplyItemId: 1, expectedQty: 0, actualQty: 0 }] });
    await request(app).post('/api/supply/closing-stock').set(staff).send({
      orderDate: DATE,
      items: [{ supplyItemId: 1, packetsLeft: 1, piecesLeft: 0, wastagePieces: 0, hasConflict: false, conflictReason: null }],
    });
    await request(app).put('/api/expenses').set(staff).send({ orderDate: DATE, items: [{ description: 'milk', amount: 28 }] });
    await request(app).put('/api/supply/closing-cash').set(staff).send({ orderDate: DATE, amount: 500 });
    expect(sent.map((s) => s.payload.title)).toEqual([
      'Stock verified', 'Closing stock logged', 'Expenses saved', 'Closing cash saved',
    ]);
    expect(sent[3].payload.body).toContain('₹500');
  });

  it('does not push the admin’s own actions back to them', async () => {
    await subscribeAdmin();
    const admin = await authHeader('admin');
    await request(app).post('/api/orders').set(admin).send(order([{ menuItemId: 1, quantity: 30 }]));
    await request(app).put('/api/supply/closing-cash').set(admin).send({ orderDate: DATE, amount: 10 });
    expect(sent).toEqual([]);
  });

  it('drops a subscription the push service says is gone', async () => {
    await subscribeAdmin({ ...SUB, endpoint: 'https://push.example.com/gone' });
    await request(app).put('/api/supply/closing-cash').set(await authHeader('staff')).send({ orderDate: DATE, amount: 1 });
    expect(await query('SELECT * FROM push_subscriptions')).toEqual([]);
  });
});
