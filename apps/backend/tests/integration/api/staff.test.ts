import { describe, it, expect } from 'vitest';
import { app, request, authHeader } from './helpers.js';
import { query } from '../../../src/db/pool.js';

const DATE = '2026-09-10';
const VEG_STEAM = 1;

describe('staff leaves API', () => {
  it('lets admin mark a staff member absent and read the month', async () => {
    const auth = await authHeader();
    const added = await request(app).post('/api/admin/leaves').set(auth)
      .send({ staffName: 'Ramesh', leaveDate: DATE, reason: 'Fever' });
    expect(added.status).toBe(201);

    const month = await request(app).get('/api/admin/leaves?month=2026-09').set(auth);
    expect(month.status).toBe(200);
    expect(month.body.byStaff).toEqual([{ staffName: 'Ramesh', count: 1 }]);
  });

  it('answers a duplicate with 409', async () => {
    const auth = await authHeader();
    await request(app).post('/api/admin/leaves').set(auth).send({ staffName: 'Ramesh', leaveDate: DATE });
    const again = await request(app).post('/api/admin/leaves').set(auth).send({ staffName: 'RAMESH', leaveDate: DATE });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/already marked absent/);
  });

  it('edits and removes a leave, logging each with before and after', async () => {
    const auth = await authHeader();
    const added = await request(app).post('/api/admin/leaves').set(auth)
      .send({ staffName: 'Ramesh', leaveDate: DATE, reason: 'Fever' });
    const edited = await request(app).put(`/api/admin/leaves/${added.body.id}`).set(auth)
      .send({ staffName: 'Ramesh', leaveDate: '2026-09-11', reason: 'Fever' });
    expect(edited.status).toBe(200);
    expect(edited.body.leaveDate).toBe('2026-09-11');
    const removed = await request(app).delete(`/api/admin/leaves/${added.body.id}`).set(auth);
    expect(removed.status).toBe(200);

    const logs = await query<{ details: string; metadata: string }>(
      `SELECT details, metadata FROM staff_operation_logs WHERE operation_type = 'staff_leave' ORDER BY id`,
    );
    expect(logs.map((l) => JSON.parse(l.metadata).action)).toEqual(['add', 'update', 'delete']);
    expect(JSON.parse(logs[1].metadata).before.leaveDate).toBe(DATE);
    expect(logs[0].details).toBe('Marked absent: Ramesh on 2026-09-10 (Fever)');
  });

  it('404s on a leave that does not exist', async () => {
    const auth = await authHeader();
    expect((await request(app).put('/api/admin/leaves/999999').set(auth)
      .send({ staffName: 'X', leaveDate: DATE })).status).toBe(404);
    expect((await request(app).delete('/api/admin/leaves/999999').set(auth)).status).toBe(404);
  });

  it('rejects a missing name, bad date or long reason', async () => {
    const auth = await authHeader();
    for (const body of [
      { staffName: '  ', leaveDate: DATE },
      { staffName: 'Ramesh', leaveDate: '10-09-2026' },
      { staffName: 'Ramesh', leaveDate: DATE, reason: 'x'.repeat(201) },
    ]) {
      const res = await request(app).post('/api/admin/leaves').set(auth).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('says why a leave was refused', async () => {
    const res = await request(app).post('/api/admin/leaves').set(await authHeader())
      .send({ staffName: 'Ramesh', leaveDate: DATE, reason: 'x'.repeat(201) });
    expect(res.body.error).toBe('Reason is too long');
  });

  it('is admin only', async () => {
    const staff = await authHeader('staff');
    expect((await request(app).get('/api/admin/leaves?month=2026-09').set(staff)).status).toBe(403);
    expect((await request(app).post('/api/admin/leaves').set(staff)
      .send({ staffName: 'Ramesh', leaveDate: DATE })).status).toBe(403);
  });
});

describe('staff takeaways API', () => {
  const body = {
    staffName: 'Ramesh', takeawayDate: DATE,
    items: [{ menuItemId: VEG_STEAM, quantity: 6, isHalf: false }],
  };

  it('lets admin record a takeaway at 25% off', async () => {
    const res = await request(app).post('/api/admin/takeaways').set(await authHeader()).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ staffName: 'Ramesh', menuValue: 89, discountPct: 25, amountOwed: 66.75 });
  });

  it('keeps staff from recording, editing or removing one', async () => {
    const staff = await authHeader('staff');
    expect((await request(app).post('/api/admin/takeaways').set(staff).send(body)).status).toBe(403);
    const added = await request(app).post('/api/admin/takeaways').set(await authHeader()).send(body);
    expect((await request(app).put(`/api/admin/takeaways/${added.body.id}`).set(staff).send(body)).status).toBe(403);
    expect((await request(app).delete(`/api/admin/takeaways/${added.body.id}`).set(staff)).status).toBe(403);
    expect((await request(app).get('/api/admin/takeaways?month=2026-09').set(staff)).status).toBe(403);
  });

  it('refuses a staff takeaway through the orders API', async () => {
    const res = await request(app).post('/api/orders').set(await authHeader('staff')).send({
      orderDate: DATE, orderType: 'staff', staffName: 'Ramesh',
      items: [{ menuItemId: VEG_STEAM, quantity: 6, isHalf: false }],
    });
    expect(res.status).toBe(400);
  });

  it('edits and removes a takeaway, logging each', async () => {
    const auth = await authHeader();
    const added = await request(app).post('/api/admin/takeaways').set(auth).send(body);
    const edited = await request(app).put(`/api/admin/takeaways/${added.body.id}`).set(auth)
      .send({ ...body, items: [{ menuItemId: VEG_STEAM, quantity: 12, isHalf: false }] });
    expect(edited.status).toBe(200);
    expect(edited.body.amountOwed).toBe(133.5);
    expect((await request(app).delete(`/api/admin/takeaways/${added.body.id}`).set(auth)).status).toBe(200);

    const logs = await query<{ details: string; metadata: string }>(
      `SELECT details, metadata FROM staff_operation_logs WHERE operation_type = 'staff_takeaway' ORDER BY id`,
    );
    expect(logs.map((l) => JSON.parse(l.metadata).action)).toEqual(['add', 'update', 'delete']);
    expect(JSON.parse(logs[1].metadata).before.amountOwed).toBe(66.75);
    expect(logs[0].details).toContain('₹66.75 owed (25% off ₹89.00)');
  });

  it('404s on a takeaway that does not exist', async () => {
    const auth = await authHeader();
    expect((await request(app).put('/api/admin/takeaways/999999').set(auth).send(body)).status).toBe(404);
    expect((await request(app).delete('/api/admin/takeaways/999999').set(auth)).status).toBe(404);
  });

  it('says why a takeaway was refused', async () => {
    const auth = await authHeader();
    const noItems = await request(app).post('/api/admin/takeaways').set(auth).send({ ...body, items: [] });
    expect(noItems.body.error).toBe('Add at least one item');
    const drink = await request(app).post('/api/admin/takeaways').set(auth)
      .send({ ...body, items: [{ menuItemId: 29, quantity: 1, isHalf: false }] });
    expect(drink.status).toBe(400);
    expect(drink.body.error).toMatch(/not a momo/);
  });

  it('gives admin the month report', async () => {
    const auth = await authHeader();
    await request(app).post('/api/admin/takeaways').set(auth).send(body);
    const res = await request(app).get('/api/admin/takeaways?month=2026-09').set(auth);
    expect(res.body).toMatchObject({ count: 1, pieces: 6, menuValue: 89, amountOwed: 66.75 });
  });

  it('shows staff the day\u2019s items so their stock screens add up', async () => {
    await request(app).post('/api/admin/takeaways').set(await authHeader()).send(body);
    const res = await request(app).get(`/api/staff/takeaway-items?date=${DATE}`).set(await authHeader('staff'));
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ menuItemId: VEG_STEAM, quantity: 6 }]);
  });

  it('suggests names to any signed-in user', async () => {
    await request(app).post('/api/admin/leaves').set(await authHeader())
      .send({ staffName: 'Ramesh', leaveDate: DATE });
    const res = await request(app).get('/api/staff/names').set(await authHeader('staff'));
    expect(res.status).toBe(200);
    expect(res.body.names).toEqual(['Ramesh']);
  });
});
