import { describe, it, expect } from 'vitest';
import { app, request, authHeader } from './helpers.js';

const DATE = '2026-09-01';
const PLATE = 6;
const VEG_STEAM = 1;

async function placeOrder(body: Record<string, unknown> = {}) {
  return request(app).post('/api/orders').set(await authHeader('staff')).send({
    orderDate: DATE,
    orderType: 'dine',
    paymentMethod: 'cash',
    items: [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }],
    ...body,
  });
}

describe('orders API', () => {
  describe('POST /api/orders', () => {
    it('creates an order and returns 201 with the priced items', async () => {
      const res = await placeOrder();
      expect(res.status).toBe(201);
      expect(res.body.totalAmount).toBe(89);
      expect(res.body.items).toHaveLength(1);
    });

    it('rejects an empty item list', async () => {
      const res = await placeOrder({ items: [] });
      expect(res.status).toBe(400);
    });

    it('rejects a malformed date', async () => {
      const res = await placeOrder({ orderDate: '01-09-2026' });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown order type', async () => {
      const res = await placeOrder({ orderType: 'delivery' });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown payment method', async () => {
      const res = await placeOrder({ paymentMethod: 'crypto' });
      expect(res.status).toBe(400);
    });

    it('rejects a zero quantity', async () => {
      const res = await placeOrder({ items: [{ menuItemId: VEG_STEAM, quantity: 0, isHalf: false }] });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown menu item', async () => {
      const res = await placeOrder({ items: [{ menuItemId: 9999, quantity: PLATE, isHalf: false }] });
      expect(res.status).toBe(400);
    });

    it('ignores a client-supplied total and prices server-side', async () => {
      const res = await placeOrder({ totalAmount: 1 });
      expect(res.status).toBe(201);
      expect(res.body.totalAmount).toBe(89);
    });
  });

  describe('GET /api/orders', () => {
    it('returns the day\'s orders', async () => {
      await placeOrder();
      const res = await request(app).get(`/api/orders?date=${DATE}`).set(await authHeader('staff'));
      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
    });

    it('requires a date', async () => {
      const res = await request(app).get('/api/orders').set(await authHeader('staff'));
      expect(res.status).toBe(400);
    });

    it('returns an empty list for a quiet day', async () => {
      const res = await request(app).get('/api/orders?date=2026-09-02').set(await authHeader('staff'));
      expect(res.status).toBe(200);
      expect(res.body.orders).toEqual([]);
    });
  });

  describe('PATCH /api/orders/:id/complete', () => {
    it('completes an order', async () => {
      const created = await placeOrder();
      const res = await request(app)
        .patch(`/api/orders/${created.body.id}/complete`)
        .set(await authHeader('staff'))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
      expect(res.body.cashAmount).toBe(89);
    });

    it('requires a payment method for a pending order', async () => {
      const created = await placeOrder({ paymentMethod: 'pending' });
      const res = await request(app)
        .patch(`/api/orders/${created.body.id}/complete`)
        .set(await authHeader('staff'))
        .send({});
      expect(res.status).toBe(400);
    });

    it('refuses to complete twice', async () => {
      const created = await placeOrder();
      const auth = await authHeader('staff');
      await request(app).patch(`/api/orders/${created.body.id}/complete`).set(auth).send({});
      const res = await request(app).patch(`/api/orders/${created.body.id}/complete`).set(auth).send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown order', async () => {
      const res = await request(app)
        .patch('/api/orders/999999999999/complete')
        .set(await authHeader('staff'))
        .send({ paymentMethod: 'cash' });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/orders/:id', () => {
    it('updates an open order', async () => {
      const created = await placeOrder();
      const res = await request(app)
        .put(`/api/orders/${created.body.id}`)
        .set(await authHeader('staff'))
        .send({ orderType: 'pack', paymentMethod: 'upi', items: [{ menuItemId: 29, quantity: 1, isHalf: false }] });
      expect(res.status).toBe(200);
      expect(res.body.totalAmount).toBe(10);
    });

    it('refuses to edit a completed order', async () => {
      const created = await placeOrder();
      const auth = await authHeader('staff');
      await request(app).patch(`/api/orders/${created.body.id}/complete`).set(auth).send({});
      const res = await request(app).put(`/api/orders/${created.body.id}`).set(auth)
        .send({ orderType: 'dine', paymentMethod: 'cash', items: [{ menuItemId: VEG_STEAM, quantity: PLATE, isHalf: false }] });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('deletes an order', async () => {
      const created = await placeOrder();
      const res = await request(app).delete(`/api/orders/${created.body.id}`).set(await authHeader('staff'));
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });

    it('returns 404 for an unknown order', async () => {
      const res = await request(app).delete('/api/orders/999999999999').set(await authHeader('staff'));
      expect(res.status).toBe(404);
    });
  });
});
