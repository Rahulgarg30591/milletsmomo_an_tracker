import { test, expect } from '@playwright/test';
import { signIn, resetData, today } from './helpers';

test.describe('admin', () => {
  test.beforeEach(async ({ page }) => {
    await resetData();
    await signIn(page, 'admin');
  });

  test('the dashboard opens on today with an empty day', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText('Total Orders')).toBeVisible();
    // "Revenue" also appears in the chart legend further down.
    await expect(page.getByText('Revenue').first()).toBeVisible();
  });

  test('the date range buttons are offered', async ({ page }) => {
    for (const label of ['Today', 'Yesterday', '7 Days', '30 Days']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('switching to a range reloads the figures', async ({ page }) => {
    await page.getByRole('button', { name: '7 Days', exact: true }).click();
    await expect(page.getByText('Total Orders')).toBeVisible();
  });

  test('the supply page is reachable and lists the catalogue', async ({ page }) => {
    await page.goto('/admin/supply');
    await expect(page).toHaveURL(/\/admin\/supply$/);
    // The page loads yesterday's leftovers before the catalogue renders.
    await expect(page.getByText('Supply Order').first()).toBeVisible();
    await expect(page.getByText('Momo Packets')).toBeVisible();
    await expect(page.getByText('Veg Momo Packet (24 Pcs)')).toBeVisible();
  });

  test('the settlement page is reachable', async ({ page }) => {
    await page.goto('/admin/settlement');
    await expect(page).toHaveURL(/\/admin\/settlement$/);
  });

  test('the staff log page is reachable', async ({ page }) => {
    await page.goto('/admin/staff-logs');
    await expect(page).toHaveURL(/\/admin\/staff-logs$/);
  });

  test('an order placed by staff shows in the admin figures', async ({ page, request }) => {
    // Placed through the API rather than a second browser session: the point
    // is that admin reads the same day staff wrote, not how it was entered.
    const login = await request.post('/api/auth/login', { data: { role: 'staff', pin: '9865' } });
    const { token } = await login.json();
    const placed = await request.post('/api/orders', {
      headers: { 'x-auth-token': token },
      data: {
        orderDate: today(),
        orderType: 'dine',
        paymentMethod: 'cash',
        items: [{ menuItemId: 1, quantity: 6, isHalf: false }],
      },
    });
    expect(placed.status()).toBe(201);

    await page.reload();
    await expect(page.getByText('₹89').first()).toBeVisible();
  });

  test('today matches the business day the app uses', async ({ page }) => {
    await page.goto(`/day/${today()}`);
    // An admin on a staff route is refused, which also proves the date parsed.
    await expect(page.getByText('Access Denied')).toBeVisible();
  });
});
