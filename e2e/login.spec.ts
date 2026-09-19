import { test, expect } from '@playwright/test';
import { signInViaPinPad as signIn, resetData } from './helpers';

test.beforeEach(async () => {
  await resetData();
});

test.describe('signing in', () => {
  // The page title appears in both the app bar and the page header, so these
  // assert the route, which is unambiguous.
  test('a staff PIN opens the day view', async ({ page }) => {
    await signIn(page, 'staff');
    await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('an admin PIN opens the dashboard', async ({ page }) => {
    await signIn(page, 'admin');
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('a wrong PIN is refused and the pad stays up', async ({ page }) => {
    await page.goto('/');
    for (const digit of '0000') {
      await page.getByRole('button', { name: `PIN digit ${digit}` }).click();
    }
    await expect(page.getByText(/invalid pin/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'PIN digit 1' })).toBeVisible();
  });

  test('a signed-out visitor cannot reach the dashboard directly', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('button', { name: 'PIN digit 1' })).toBeVisible();
  });

  test('staff are refused the admin dashboard', async ({ page }) => {
    await signIn(page, 'staff');
    await page.goto('/admin');
    await expect(page.getByText('Access Denied')).toBeVisible();
  });

  test('signing out returns to the PIN pad', async ({ page }) => {
    await signIn(page, 'staff');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('button', { name: 'PIN digit 1' })).toBeVisible();
  });
});
