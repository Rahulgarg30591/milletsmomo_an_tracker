import { http, HttpResponse } from 'msw';
import { buildMenu } from 'shared';

/** A token shaped like the real one: header.payload.signature, base64 parts. */
export function makeToken(role: 'staff' | 'admin' = 'staff', expiresInSeconds = 3600): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'MM' }));
  const payload = btoa(JSON.stringify({
    sub: role === 'admin' ? '3' : '1',
    role,
    displayName: role === 'admin' ? 'Owner' : 'Cart Staff',
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }));
  return `${header}.${payload}.signature`;
}

export const emptyDay = {
  date: '2026-09-18',
  orders: [],
};

export const handlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { role: 'staff' | 'admin'; pin: string };
    if (body.pin !== '9865' && body.pin !== '1703') {
      return HttpResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }
    const role = body.pin === '1703' ? 'admin' : 'staff';
    return HttpResponse.json({
      token: makeToken(role),
      userId: role === 'admin' ? 3 : 1,
      role,
      displayName: role === 'admin' ? 'Owner' : 'Cart Staff',
      expiresIn: 43200,
    });
  }),

  http.get('*/api/menu', () => HttpResponse.json({ items: buildMenu() })),
  http.get('*/api/orders', () => HttpResponse.json(emptyDay)),
  http.post('*/api/orders', () => HttpResponse.json({ id: 1, items: [] }, { status: 201 })),
  http.get('*/api/supply/verification', () => HttpResponse.json(null)),
  http.get('*/api/supply/closing-stock', () => HttpResponse.json(null)),
  http.get('*/api/admin/*', () => HttpResponse.json({})),
  http.post('*/api/client-logs', () => HttpResponse.json({ success: true, inserted: 0 }, { status: 201 })),
  http.get('*/api/health', () => HttpResponse.json({ status: 'ok', db: 'connected' })),
];
