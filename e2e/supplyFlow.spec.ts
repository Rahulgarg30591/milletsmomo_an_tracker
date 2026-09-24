import { test, expect, APIRequestContext } from '@playwright/test';
import { signIn, resetData, today, PINS } from './helpers';

const VEG_PACKET = 1;
const PANEER_PACKET = 2;

function yesterday(): string {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function token(request: APIRequestContext, role: 'staff' | 'admin'): Promise<string> {
  const login = await request.post('/api/auth/login', { data: { role, pin: PINS[role] } });
  return (await login.json()).token;
}

/** Sets the scene through the API: the flows under test are the screens. */
async function seed(
  request: APIRequestContext,
  { leftover, order }: { leftover?: { supplyItemId: number; packetsLeft: number }; order?: { supplyItemId: number; quantity: number }[] },
) {
  const admin = { 'x-auth-token': await token(request, 'admin') };
  if (leftover) {
    const res = await request.post('/api/supply/closing-stock', {
      headers: admin,
      data: {
        orderDate: yesterday(),
        items: [{ ...leftover, piecesLeft: 0, wastagePieces: 0, hasConflict: false, conflictReason: null }],
      },
    });
    expect(res.status()).toBe(201);
  }
  if (order) {
    const res = await request.post('/api/admin/supply/order', { headers: admin, data: { orderDate: today(), items: order } });
    expect(res.status()).toBe(201);
  }
  return admin;
}

test.describe('supply that never arrived', () => {
  test.beforeEach(async () => {
    await resetData();
  });

  test('admin can still mark No Supply Today over an existing order', async ({ page, request }) => {
    const admin = await seed(request, { order: [{ supplyItemId: VEG_PACKET, quantity: 3 }] });
    await signIn(page, 'admin');
    await page.goto(`/admin/supply?date=${today()}`);

    const noSupply = page.getByRole('button', { name: 'No Supply Today' });
    await expect(noSupply).toBeEnabled();
    await noSupply.click();
    await page.getByRole('button', { name: 'Cancel Order' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const order = await request.get(`/api/admin/supply/order?date=${today()}`, { headers: admin });
    expect((await order.json()).items).toEqual([]);
    const flag = await request.get(`/api/admin/supply/no-supply?date=${today()}`, { headers: admin });
    expect((await flag.json()).noSupply).toBe(true);
  });

  test('staff closing stock then works from yesterday’s leftovers alone', async ({ page, request }) => {
    const admin = await seed(request, {
      leftover: { supplyItemId: VEG_PACKET, packetsLeft: 1 },
      order: [{ supplyItemId: VEG_PACKET, quantity: 2 }],
    });
    await request.post('/api/admin/supply/no-supply', { headers: admin, data: { orderDate: today() } });

    await signIn(page, 'staff');
    await page.goto(`/day/${today()}/closing`);
    await expect(page.getByText('No Supply Today')).toBeVisible();
    // One packet left yesterday, none arrived, nothing sold yet.
    await expect(page.getByText('24 momos')).toBeVisible();
  });
});

test.describe('partial supply', () => {
  test.beforeEach(async () => {
    await resetData();
  });

  test('a type left out of the order still gets a closing count', async ({ page, request }) => {
    await seed(request, {
      leftover: { supplyItemId: PANEER_PACKET, packetsLeft: 2 },
      order: [{ supplyItemId: VEG_PACKET, quantity: 1 }],
    });

    await signIn(page, 'staff');
    await page.goto(`/day/${today()}/closing`);
    await expect(page.getByText('Paneer Momo Packet', { exact: true })).toBeVisible();
    await expect(page.getByText('Expected: 2 pkt + 0 pcs')).toBeVisible();
    await expect(page.getByText('Veg Momo Packet', { exact: true })).toBeVisible();
  });
});
