import { describe, it, expect } from 'vitest';
import { app, request, authHeader } from './helpers.js';

const DATE = '2026-09-05';
const VEG_PACKET = 1;
const RED_SAUCE = 4;

describe('admin API', () => {
  it('summarises a day', async () => {
    const res = await request(app).get(`/api/admin/summary?date=${DATE}`).set(await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.totalOrders).toBe(0);
  });

  it('requires a date on the summary', async () => {
    const res = await request(app).get('/api/admin/summary').set(await authHeader());
    expect(res.status).toBe(400);
  });

  it('rejects a malformed date', async () => {
    const res = await request(app).get('/api/admin/summary?date=nonsense').set(await authHeader());
    expect(res.status).toBe(400);
  });

  it('accepts a date range', async () => {
    const res = await request(app)
      .get(`/api/admin/summary?date=${DATE}&endDate=2026-09-06`).set(await authHeader());
    expect(res.status).toBe(200);
  });

  it('returns admin orders', async () => {
    const res = await request(app).get(`/api/admin/orders?date=${DATE}`).set(await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });

  it('returns staff logs', async () => {
    const res = await request(app).get(`/api/admin/staff-logs?date=${DATE}`).set(await authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });
});

describe('supply API', () => {
  it('lists the supply catalogue', async () => {
    const res = await request(app).get('/api/admin/supply/items').set(await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.items ?? res.body).toHaveLength(8);
  });

  it('creates a supply order', async () => {
    const res = await request(app).post('/api/admin/supply/order').set(await authHeader())
      .send({ orderDate: DATE, items: [{ supplyItemId: VEG_PACKET, quantity: 3 }] });
    expect(res.status).toBe(201);
    expect(res.body.totalCost).toBe(414);
  });

  it('rejects a supply order with no items', async () => {
    const res = await request(app).post('/api/admin/supply/order').set(await authHeader())
      .send({ orderDate: DATE, items: [] });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown supply item', async () => {
    const res = await request(app).post('/api/admin/supply/order').set(await authHeader())
      .send({ orderDate: DATE, items: [{ supplyItemId: 9999, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('updates an existing supply order', async () => {
    const auth = await authHeader();
    await request(app).post('/api/admin/supply/order').set(auth)
      .send({ orderDate: DATE, items: [{ supplyItemId: VEG_PACKET, quantity: 3 }] });
    const res = await request(app).put('/api/admin/supply/order').set(auth)
      .send({ orderDate: DATE, items: [{ supplyItemId: RED_SAUCE, quantity: 2 }] });
    expect(res.status).toBe(200);
    expect(res.body.totalCost).toBe(160);
  });

  it('reads back a day\'s supply order', async () => {
    const auth = await authHeader();
    await request(app).post('/api/admin/supply/order').set(auth)
      .send({ orderDate: DATE, items: [{ supplyItemId: VEG_PACKET, quantity: 1 }] });
    const res = await request(app).get(`/api/admin/supply/order?date=${DATE}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('records a verification', async () => {
    const auth = await authHeader();
    await request(app).post('/api/admin/supply/order').set(auth)
      .send({ orderDate: DATE, items: [{ supplyItemId: VEG_PACKET, quantity: 3 }] });
    const res = await request(app).post('/api/supply/verification').set(auth)
      .send({ orderDate: DATE, items: [{ supplyItemId: VEG_PACKET, expectedQty: 3, actualQty: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.conflictCount).toBe(1);
  });

  it('records closing stock', async () => {
    const auth = await authHeader();
    await request(app).post('/api/admin/supply/order').set(auth)
      .send({ orderDate: DATE, items: [{ supplyItemId: VEG_PACKET, quantity: 3 }] });
    const res = await request(app).post('/api/supply/closing-stock').set(auth).send({
      orderDate: DATE,
      items: [{ supplyItemId: VEG_PACKET, packetsLeft: 1, piecesLeft: 6, wastagePieces: 0, hasConflict: false, conflictReason: null }],
    });
    expect(res.status).toBe(201);
    expect(res.body.isSubmitted).toBe(true);
  });

  it('marks no supply over an existing order, cancelling it', async () => {
    const auth = await authHeader();
    await request(app).post('/api/admin/supply/order').set(auth)
      .send({ orderDate: DATE, items: [{ supplyItemId: VEG_PACKET, quantity: 3 }] });

    const res = await request(app).post('/api/admin/supply/no-supply').set(auth).send({ orderDate: DATE });
    expect(res.status).toBe(201);
    expect(res.body.cancelledOrderId).toEqual(expect.any(Number));

    const order = await request(app).get(`/api/admin/supply/order?date=${DATE}`).set(auth);
    expect(order.body.items).toEqual([]);
    const flag = await request(app).get(`/api/admin/supply/no-supply?date=${DATE}`).set(auth);
    expect(flag.body.noSupply).toBe(true);
  });

  it('does not log no supply twice', async () => {
    const auth = await authHeader();
    await request(app).post('/api/admin/supply/no-supply').set(auth).send({ orderDate: DATE });
    const again = await request(app).post('/api/admin/supply/no-supply').set(auth).send({ orderDate: DATE });
    expect(again.status).toBe(200);
    expect(again.body.cancelledOrderId).toBeNull();
  });
});

describe('expenses API', () => {
  it('starts empty', async () => {
    const res = await request(app).get(`/api/expenses?date=${DATE}`).set(await authHeader('staff'));
    expect(res.status).toBe(200);
    expect(res.body.totalAmount).toBe(0);
  });

  it('saves and totals a day', async () => {
    const res = await request(app).put('/api/expenses').set(await authHeader('staff'))
      .send({ orderDate: DATE, items: [{ description: 'gas', amount: 100 }, { description: 'veg', amount: 50.5 }] });
    // The route is a PUT that replaces the day, but the controller answers 201.
    // Asserted as-is so a deliberate change to 200 is a visible decision.
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(150.5);
  });

  it('rejects a negative amount', async () => {
    const res = await request(app).put('/api/expenses').set(await authHeader('staff'))
      .send({ orderDate: DATE, items: [{ description: 'refund', amount: -5 }] });
    expect(res.status).toBe(400);
  });

  it('rejects an empty description', async () => {
    const res = await request(app).put('/api/expenses').set(await authHeader('staff'))
      .send({ orderDate: DATE, items: [{ description: '', amount: 5 }] });
    expect(res.status).toBe(400);
  });
});

describe('settlement API', () => {
  it('summarises an unsettled day', async () => {
    const res = await request(app).get(`/api/admin/settlement?date=${DATE}`).set(await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.isSettled).toBe(false);
  });

  it('records a settlement', async () => {
    const res = await request(app).post('/api/admin/settlement').set(await authHeader())
      .send({ orderDate: DATE, actualCash: 0, actualUpi: 0, notes: 'quiet day' });
    expect(res.status).toBe(201);
    expect(res.body.notes).toBe('quiet day');
  });

  it('keeps staff out of settlements', async () => {
    const res = await request(app).get(`/api/admin/settlement?date=${DATE}`).set(await authHeader('staff'));
    expect(res.status).toBe(403);
  });
});

describe('client logs API', () => {
  it('accepts a batch', async () => {
    const res = await request(app).post('/api/client-logs').set(await authHeader('staff'))
      .send({ logs: [
        { type: 'page_view', page: '/orders', details: 'opened', metadata: { a: 1 } },
        { type: 'action', page: '/orders', details: 'tapped' },
      ] });
    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(2);
  });

  it('rejects an empty batch', async () => {
    const res = await request(app).post('/api/client-logs').set(await authHeader('staff')).send({ logs: [] });
    expect(res.status).toBe(400);
  });
});

describe('menu API', () => {
  it('returns all thirty items including beverages', async () => {
    const res = await request(app).get('/api/menu').set(await authHeader('staff'));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(30);
    const water = res.body.items.find((i: any) => i.id === 30);
    expect(water.fullPrice).toBe(10);
  });
});
