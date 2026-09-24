import { describe, it, expect } from 'vitest';
import { app, request, authHeader } from './helpers.js';
import { query } from '../../../src/db/pool.js';

const DATE = '2026-09-10';

describe('cylinders API', () => {
  it('lets staff log a refill and read it back', async () => {
    const auth = await authHeader('staff');
    const added = await request(app).post('/api/cylinders').set(auth)
      .send({ refillDate: DATE, brand: 'INDANE', amount: 905 });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ brand: 'INDANE', amount: 905 });

    const day = await request(app).get(`/api/cylinders?date=${DATE}`).set(auth);
    expect(day.status).toBe(200);
    expect(day.body.refills).toHaveLength(1);
  });

  it('writes a staff log entry for each add and delete', async () => {
    const auth = await authHeader('staff');
    const added = await request(app).post('/api/cylinders').set(auth)
      .send({ refillDate: DATE, brand: 'HP', amount: 950 });
    await request(app).delete(`/api/cylinders/${added.body.id}`).set(auth);

    const logs = await query<{ details: string; metadata: string }>(
      `SELECT details, metadata FROM staff_operation_logs
       WHERE operation_type = 'cylinder_refill' ORDER BY id`,
    );
    expect(logs.map((l) => JSON.parse(l.metadata).action)).toEqual(['add', 'delete']);
    expect(logs[0].details).toContain('HP (Hindustan Petroleum)');
    expect(logs[0].details).toContain('950.00');
  });

  it('shows cylinder entries in the admin staff log filter', async () => {
    await request(app).post('/api/cylinders').set(await authHeader('staff'))
      .send({ refillDate: DATE, brand: 'BP', amount: 910 });
    const res = await request(app).get(`/api/admin/staff-logs?date=${DATE}&type=cylinder_refill`)
      .set(await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(1);
  });

  it('rejects an unknown brand', async () => {
    const res = await request(app).post('/api/cylinders').set(await authHeader('staff'))
      .send({ refillDate: DATE, brand: 'SHELL', amount: 900 });
    expect(res.status).toBe(400);
  });

  it('rejects a missing or silly price', async () => {
    const auth = await authHeader('staff');
    for (const amount of [undefined, 0, -5, 250000]) {
      const res = await request(app).post('/api/cylinders').set(auth)
        .send({ refillDate: DATE, brand: 'HP', amount });
      expect(res.status, `amount ${amount}`).toBe(400);
    }
  });

  it('404s deleting a refill that does not exist', async () => {
    const res = await request(app).delete('/api/cylinders/999999').set(await authHeader('staff'));
    expect(res.status).toBe(404);
  });

  it('requires sign-in', async () => {
    const res = await request(app).get(`/api/cylinders?date=${DATE}`);
    expect(res.status).toBe(401);
  });

  it('gives admin the month report', async () => {
    const staff = await authHeader('staff');
    await request(app).post('/api/cylinders').set(staff).send({ refillDate: '2026-09-02', brand: 'HP', amount: 950 });
    await request(app).post('/api/cylinders').set(staff).send({ refillDate: '2026-09-19', brand: 'BP', amount: 910 });

    const res = await request(app).get('/api/admin/cylinders?month=2026-09').set(await authHeader());
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.totalAmount).toBe(1860);
  });

  it('keeps the month report from staff', async () => {
    const res = await request(app).get('/api/admin/cylinders?month=2026-09').set(await authHeader('staff'));
    expect(res.status).toBe(403);
  });

  it('rejects a malformed month', async () => {
    const res = await request(app).get('/api/admin/cylinders?month=2026-13').set(await authHeader());
    expect(res.status).toBe(400);
  });

  it('lets staff edit a refill, logging before and after', async () => {
    const auth = await authHeader('staff');
    const added = await request(app).post('/api/cylinders').set(auth)
      .send({ refillDate: DATE, brand: 'HP', amount: 950 });
    const edited = await request(app).put(`/api/cylinders/${added.body.id}`).set(auth)
      .send({ brand: 'INDANE', amount: 905, source: 'Gupta Gas' });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ brand: 'INDANE', amount: 905, source: 'Gupta Gas' });

    const logs = await query<{ details: string; metadata: string }>(
      `SELECT details, metadata FROM staff_operation_logs
       WHERE operation_type = 'cylinder_refill' ORDER BY id DESC LIMIT 1`,
    );
    const meta = JSON.parse(logs[0].metadata);
    expect(meta.action).toBe('update');
    expect(meta.before).toEqual({ brand: 'HP', amount: 950, source: null });
    expect(logs[0].details).toContain('→ Indane ₹905.00 from Gupta Gas');
  });

  it('404s editing a refill that does not exist', async () => {
    const res = await request(app).put('/api/cylinders/999999').set(await authHeader('staff'))
      .send({ brand: 'HP', amount: 950 });
    expect(res.status).toBe(404);
  });

  it('rejects an edit with a bad price', async () => {
    const auth = await authHeader('staff');
    const added = await request(app).post('/api/cylinders').set(auth)
      .send({ refillDate: DATE, brand: 'HP', amount: 950 });
    const res = await request(app).put(`/api/cylinders/${added.body.id}`).set(auth)
      .send({ brand: 'HP', amount: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects a source over 100 characters', async () => {
    const res = await request(app).post('/api/cylinders').set(await authHeader('staff'))
      .send({ refillDate: DATE, brand: 'HP', amount: 950, source: 'x'.repeat(101) });
    expect(res.status).toBe(400);
  });

  it('offers staff the sources used before', async () => {
    const auth = await authHeader('staff');
    await request(app).post('/api/cylinders').set(auth)
      .send({ refillDate: DATE, brand: 'HP', amount: 950, source: 'Gupta Gas' });
    const res = await request(app).get('/api/cylinders/sources').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.sources).toEqual(['Gupta Gas']);
  });
});
