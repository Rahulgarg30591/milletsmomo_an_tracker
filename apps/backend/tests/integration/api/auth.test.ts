import { describe, it, expect } from 'vitest';
import { app, request, PINS, authHeader } from './helpers.js';

describe('POST /api/auth/login', () => {
  it('returns a token for a correct PIN', async () => {
    const res = await request(app).post('/api/auth/login').send({ role: 'admin', pin: PINS.admin });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.role).toBe('admin');
  });

  it('rejects a wrong PIN with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ role: 'admin', pin: '0000' });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('rejects a malformed body with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('never returns the PIN hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ role: 'admin', pin: PINS.admin });
    expect(JSON.stringify(res.body)).not.toContain('$2b$');
  });

  it('advertises the rate limit', async () => {
    const res = await request(app).post('/api/auth/login').send({ role: 'admin', pin: '0001' });
    expect(res.headers).toHaveProperty('ratelimit-limit');
  });
});

describe('authentication middleware', () => {
  it('refuses a request with no token', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(401);
  });

  it('refuses a forged token', async () => {
    const res = await request(app).get('/api/menu').set('x-auth-token', 'a.b.c');
    expect(res.status).toBe(401);
  });

  it('refuses a token whose payload was tampered with', async () => {
    const header = await authHeader('staff');
    const [h, payload, sig] = header['x-auth-token'].split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    decoded.role = 'admin';
    const forged = Buffer.from(JSON.stringify(decoded)).toString('base64');
    const res = await request(app).get('/api/menu').set('x-auth-token', `${h}.${forged}.${sig}`);
    expect(res.status).toBe(401);
  });

  it('ignores an Authorization header, which the host injects', async () => {
    const res = await request(app).get('/api/menu').set('Authorization', 'Bearer anything');
    expect(res.status).toBe(401);
  });

  it('accepts a valid token', async () => {
    const res = await request(app).get('/api/menu').set(await authHeader());
    expect(res.status).toBe(200);
  });
});

describe('role enforcement', () => {
  it('keeps staff out of the admin summary', async () => {
    const res = await request(app).get('/api/admin/summary?date=2026-01-01').set(await authHeader('staff'));
    expect(res.status).toBe(403);
  });

  it('lets an admin through', async () => {
    const res = await request(app).get('/api/admin/summary?date=2026-01-01').set(await authHeader('admin'));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/health', () => {
  it('reports the database connection without a token', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'connected' });
  });
});
