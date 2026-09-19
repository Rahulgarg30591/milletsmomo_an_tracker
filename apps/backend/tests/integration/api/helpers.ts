import request from 'supertest';
import app from '../../../src/app.js';

export { app, request };

/** Seeded PINs, from seed.sql. */
export const PINS = { admin: '1703', staff: '9865' } as const;

/** Signs in and returns the header the API expects. */
export async function authHeader(role: 'admin' | 'staff' = 'admin'): Promise<Record<string, string>> {
  const res = await request(app).post('/api/auth/login').send({ role, pin: PINS[role] });
  if (res.status !== 200) {
    throw new Error(`login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  // Azure Static Web Apps injects its own Authorization header when proxying,
  // so the app carries the user's token in a header of its own.
  return { 'x-auth-token': res.body.token };
}
