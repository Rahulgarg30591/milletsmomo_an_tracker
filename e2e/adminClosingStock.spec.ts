import { test, expect, APIRequestContext } from '@playwright/test';
import { signIn, resetData, today, PINS } from './helpers';

async function token(request: APIRequestContext, role: 'staff' | 'admin'): Promise<string> {
  const login = await request.post('/api/auth/login', { data: { role, pin: PINS[role] } });
  return (await login.json()).token;
}

function yesterday(): string {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const count = (supplyItemId: number, packetsLeft: number, piecesLeft = 0, extra = {}) => ({
  supplyItemId, packetsLeft, piecesLeft, wastagePieces: 0, hasConflict: false, conflictReason: null, ...extra,
});

/** Yesterday closed with one Veg packet (24); today one plate sold and one taken by staff. */
async function setUpDay(request: APIRequestContext) {
  const staff = { 'x-auth-token': await token(request, 'staff') };
  const admin = { 'x-auth-token': await token(request, 'admin') };
  await request.post('/api/supply/closing-stock', { headers: staff, data: { orderDate: yesterday(), items: [count(1, 1)] } });
  await request.post('/api/orders', {
    headers: staff,
    data: { orderDate: today(), orderType: 'dine', paymentMethod: 'cash', items: [{ menuItemId: 1, quantity: 6, isHalf: false }] },
  });
  await request.post('/api/admin/takeaways', {
    headers: admin,
    data: { staffName: 'Ramesh', takeawayDate: today(), items: [{ menuItemId: 1, quantity: 6, isHalf: false }] },
  });
  return { staff };
}

test.describe('admin closing stock', () => {
  test.beforeEach(async () => {
    await resetData();
  });

  test('is reachable from the dashboard and says when nothing is recorded', async ({ page, request }) => {
    await setUpDay(request);
    await signIn(page, 'admin');
    await page.getByRole('button', { name: 'Closing Stock' }).click();
    await expect(page).toHaveURL(/\/admin\/closing-stock\?date=\d{4}-\d{2}-\d{2}$/);

    await expect(page.getByTestId('closing-status')).toContainText('Not recorded yet');
    // 24 opening − 6 sold − 6 taken by staff.
    const veg = page.getByTestId('closing-row').filter({ hasText: 'Veg Momo Packet' });
    await expect(veg).toContainText('12 pcs');
    await expect(veg).toContainText('Opening 24 · gone 12');
  });

  test('shows what staff counted against what was expected, and why', async ({ page, request }) => {
    const { staff } = await setUpDay(request);
    await request.post('/api/supply/closing-stock', {
      headers: staff,
      data: { orderDate: today(), items: [count(1, 0, 10, { wastagePieces: 1, hasConflict: true, conflictReason: 'torn packet' }), count(2, 0), count(3, 0)] },
    });

    await signIn(page, 'admin');
    await page.goto('/admin/closing-stock');
    const status = page.getByTestId('closing-status');
    await expect(status).toContainText('1 item off');
    await expect(status).toContainText('Recorded by Cart Staff');

    const veg = page.getByTestId('closing-row').filter({ hasText: 'Veg Momo Packet' });
    // 12 expected; 10 counted + 1 wasted leaves 1 unaccounted for.
    await expect(veg.getByTestId('closing-diff')).toHaveText('-1 pcs');
    await expect(veg).toContainText('Flagged by staff: torn packet');
    await expect(veg).toContainText('wastage 1');
    await expect(page.getByTestId('closing-row').filter({ hasText: 'Paneer' }).getByTestId('closing-diff')).toHaveText('✓ match');
  });

  test('moves between days', async ({ page, request }) => {
    await setUpDay(request);
    await signIn(page, 'admin');
    await page.goto('/admin/closing-stock');
    await expect(page.getByRole('button', { name: 'Next day' })).toBeDisabled();
    await page.getByRole('button', { name: 'Previous day' }).click();
    await expect(page).toHaveURL(new RegExp(`date=${yesterday()}$`));
    await expect(page.getByTestId('closing-status')).toContainText('Recorded by');
  });

  test('is for admin only', async ({ page }) => {
    await signIn(page, 'staff');
    await page.goto('/admin/closing-stock');
    await expect(page.getByText('Access Denied')).toBeVisible();
  });
});
